// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {
    AccessControlEnumerableUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/extensions/AccessControlEnumerableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BurrowMath} from "./libraries/BurrowMath.sol";
import {Doubloon} from "./tokens/Doubloon.sol";

/// @title RabbitTreasury (Burrow)
/// @notice Player-facing reserve game: reserve deposits → DOUB mint, DOUB burn → reserve withdrawal,
///         epoch-based repricing via BurrowMath. Protocol revenue (fees, router inflows) is split between
///         a non-redeemable protocol bucket and burn, so DOUB redemption draws only from **redeemable**
///         backing. Canonical Burrow* events per docs/product/rabbit-treasury.md.
///
/// @dev **reasonCode** on `BurrowReserveBalanceUpdated`: 1 deposit, 2 withdraw (user payout from vault),
///      3 fee (protocol revenue; `delta` is net change to vault after burn to sink). Withdrawal fees are
///      logged via `BurrowWithdrawalFeeAccrued` (redeemable → protocol bucket, no change to total balance).
/// @dev Production: UUPS proxy; **proxy address** is canonical for Burrow integrations (GitLab #54).
contract RabbitTreasury is Initializable, AccessControlEnumerableUpgradeable, PausableUpgradeable, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;

    /// @notice Upper bound for `betaWad` (governed); keeps PRB `exp`/`tanh` paths within tested envelopes (`BurrowMath`).
    /// @dev Must stay aligned with `contracts/PARAMETERS.md` § Rabbit Treasury (Burrow); GitLab #119.
    uint256 internal constant MAX_BURROW_BETA_WAD = 10 * WAD;

    /// @notice Upper bound for `deltaMaxFracWad` — max fraction of `e` movable per finalize step (WAD-scaled).
    /// @dev Default deploy uses `2e16` (2%); cap allows headroom for governance without unbounded jumps.
    uint256 internal constant MAX_BURROW_DELTA_MAX_FRAC_WAD = 20 * 1e16;

    /// @notice Default burn sink when constructor `_burnSink` is zero (standard dead address).
    address public constant DEFAULT_BURN_SINK = 0x000000000000000000000000000000000000dEaD;

    // ── Roles ──────────────────────────────────────────────────────────
    bytes32 public constant FEE_ROUTER_ROLE = keccak256("FEE_ROUTER");
    bytes32 public constant PARAMS_ROLE = keccak256("PARAMS");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER");

    // ── Assets ─────────────────────────────────────────────────────────
    IERC20 public reserveAsset;
    Doubloon public doub;

    /// @notice Tokens sent here are treated as burned for accounting (not redeemable).
    address public burnSink;

    // ── BurrowMath parameters ──────────────────────────────────────────
    uint256 public cMaxWad;
    uint256 public cStarWad;
    uint256 public alphaWad;
    uint256 public betaWad;
    uint256 public mMinWad;
    uint256 public mMaxWad;
    uint256 public lamWad;
    uint256 public deltaMaxFracWad;
    uint256 public eps;

    // ── Epoch state ────────────────────────────────────────────────────
    uint256 public currentEpochId;
    uint256 public epochDuration;
    uint256 public epochStart;
    uint256 public epochEnd;

    // ── Internal pricing ───────────────────────────────────────────────
    uint256 public eWad;

    /// @notice CL8Y/reserve that backs ordinary DOUB redemption (user deposits).
    uint256 public redeemableBacking;

    /// @notice Non-redeemable reserve: protocol revenue share, withdrawal fees, etc.
    uint256 public protocolOwnedBacking;

    // ── Controlled redemption & fee policy (governed) ──────────────────
    /// @notice Fraction of each `receiveFee` gross amount sent to `burnSink` (WAD). Rest → protocol bucket.
    uint256 public protocolRevenueBurnShareWad;
    /// @notice Fraction of each withdrawal payout (after efficiency) charged as fee (WAD) → protocol bucket.
    uint256 public withdrawFeeWad;
    /// @notice When redemption health is 0, withdrawals receive this fraction of the post-pro-rata amount (WAD).
    uint256 public minRedemptionEfficiencyWad;
    /// @notice Minimum epochs between successful withdrawals per address; 0 disables.
    uint256 public redemptionCooldownEpochs;

    // ── Cumulative accounting (transparency) ─────────────────────────────
    /// @notice Sum of gross amounts passed to `receiveFee` (before burn / protocol split).
    uint256 public cumulativeFees;
    uint256 public cumulativeBurned;
    uint256 public cumulativeWithdrawFees;

    // ── Reason codes for BurrowReserveBalanceUpdated ───────────────────
    uint8 public constant REASON_DEPOSIT = 1;
    uint8 public constant REASON_WITHDRAW = 2;
    uint8 public constant REASON_FEE = 3;

    // ── Canonical Burrow* events ───────────────────────────────────────
    event BurrowEpochOpened(uint256 indexed epochId, uint256 startTimestamp, uint256 endTimestamp);
    event BurrowHealthEpochFinalized(
        uint256 indexed epochId,
        uint256 finalizedAt,
        uint256 reserveRatioWad,
        uint256 doubTotalSupply,
        uint256 repricingFactorWad,
        uint256 backingPerDoubloonWad,
        uint256 internalStateEWad
    );
    event BurrowEpochReserveSnapshot(uint256 indexed epochId, address indexed reserveAsset, uint256 balance);
    event BurrowReserveBalanceUpdated(
        address indexed reserveAsset, uint256 balanceAfter, int256 delta, uint8 reasonCode
    );
    event BurrowReserveBuckets(
        uint256 indexed epochId, uint256 redeemableBacking, uint256 protocolOwnedBacking, uint256 totalBacking
    );
    event BurrowDeposited(
        address indexed user,
        address indexed reserveAsset,
        uint256 amount,
        uint256 doubOut,
        uint256 indexed epochId,
        uint256 factionId
    );
    event BurrowWithdrawn(
        address indexed user,
        address indexed reserveAsset,
        uint256 amount,
        uint256 doubIn,
        uint256 indexed epochId,
        uint256 factionId
    );
    event BurrowFeeAccrued(address indexed asset, uint256 amount, uint256 cumulativeInAsset, uint256 indexed epochId);
    event BurrowProtocolRevenueSplit(
        uint256 indexed epochId, uint256 grossAmount, uint256 toProtocolBucket, uint256 burnedAmount
    );
    event BurrowWithdrawalFeeAccrued(address indexed asset, uint256 feeAmount, uint256 cumulativeWithdrawFees);
    event BurrowRepricingApplied(
        uint256 indexed epochId, uint256 repricingFactorWad, uint256 priorInternalPriceWad, uint256 newInternalPriceWad
    );
    event ParamsUpdated(address indexed actor, string paramName, uint256 oldValue, uint256 newValue);

    /// @notice Last epoch in which `msg.sender` completed a withdrawal (for cooldown).
    mapping(address => uint256) public lastWithdrawEpochId;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _reserveAsset,
        Doubloon _doub,
        uint256 _epochDuration,
        uint256 _cMaxWad,
        uint256 _cStarWad,
        uint256 _alphaWad,
        uint256 _betaWad,
        uint256 _mMinWad,
        uint256 _mMaxWad,
        uint256 _lamWad,
        uint256 _deltaMaxFracWad,
        uint256 _eps,
        uint256 _protocolRevenueBurnShareWad,
        uint256 _withdrawFeeWad,
        uint256 _minRedemptionEfficiencyWad,
        uint256 _redemptionCooldownEpochs,
        address _burnSink,
        address admin
    ) external initializer {
        require(address(_reserveAsset) != address(0), "RT: zero reserve");
        require(address(_doub) != address(0), "RT: zero doub");
        require(_epochDuration > 0, "RT: zero epoch");
        require(_protocolRevenueBurnShareWad < WAD, "RT: burn share >= 100%");
        require(_withdrawFeeWad < WAD, "RT: withdraw fee >= 100%");
        require(_minRedemptionEfficiencyWad > 0 && _minRedemptionEfficiencyWad <= WAD, "RT: min eff");
        _validateBurrowCurveParams(_cMaxWad, _cStarWad, _alphaWad, _betaWad, _lamWad, _deltaMaxFracWad);
        require(admin != address(0), "RT: zero admin");

        __AccessControlEnumerable_init();
        __AccessControl_init();
        __Pausable_init();

        reserveAsset = _reserveAsset;
        doub = _doub;
        burnSink = _burnSink == address(0) ? DEFAULT_BURN_SINK : _burnSink;
        epochDuration = _epochDuration;

        cMaxWad = _cMaxWad;
        cStarWad = _cStarWad;
        alphaWad = _alphaWad;
        betaWad = _betaWad;
        mMinWad = _mMinWad;
        mMaxWad = _mMaxWad;
        lamWad = _lamWad;
        deltaMaxFracWad = _deltaMaxFracWad;
        eps = _eps;
        eWad = WAD; // initial exchange rate = 1.0

        protocolRevenueBurnShareWad = _protocolRevenueBurnShareWad;
        withdrawFeeWad = _withdrawFeeWad;
        minRedemptionEfficiencyWad = _minRedemptionEfficiencyWad;
        redemptionCooldownEpochs = _redemptionCooldownEpochs;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PARAMS_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}

    /// @dev Shared envelope for initializer and Burrow curve `PARAMS_ROLE` setters (GitLab #119).
    function _validateBurrowCurveParams(
        uint256 cMax,
        uint256 cStar,
        uint256 alpha,
        uint256 beta,
        uint256 lam,
        uint256 deltaMaxFrac
    ) private pure {
        require(cStar > 0 && cStar <= cMax, "RT: cStar");
        require(alpha < WAD, "RT: alpha");
        require(beta > 0 && beta <= MAX_BURROW_BETA_WAD, "RT: beta");
        require(lam > 0 && lam <= WAD, "RT: lam");
        require(deltaMaxFrac > 0 && deltaMaxFrac <= MAX_BURROW_DELTA_MAX_FRAC_WAD, "RT: deltaMax");
    }

    /// @notice Total reserve tokens held in accounting (must match `reserveAsset.balanceOf(this)` after ops).
    function totalReserves() external view returns (uint256) {
        return redeemableBacking + protocolOwnedBacking;
    }

    /// @notice Same as `totalReserves`; alias for docs/UI wording.
    function totalBacking() external view returns (uint256) {
        return redeemableBacking + protocolOwnedBacking;
    }

    /// @notice Nominal liability in reserve units: supply * e / WAD.
    function redemptionLiabilityWad() external view returns (uint256) {
        uint256 supply = doub.totalSupply();
        if (supply == 0) return 0;
        return Math.mulDiv(supply, eWad, WAD);
    }

    /// @notice Redemption health: redeemableBacking / liability (WAD), capped at 1.0 for penalty curve.
    function redemptionHealthWad() public view returns (uint256) {
        uint256 supply = doub.totalSupply();
        if (supply == 0) return WAD;
        uint256 liability = Math.mulDiv(supply, eWad, WAD) + eps;
        uint256 raw = Math.mulDiv(redeemableBacking, WAD, liability);
        return Math.min(raw, WAD);
    }

    /// @notice Preview withdrawal payout for `doubAmount` at current state (no state change).
    /// @dev Uses `msg.sender` for redemption-cooldown preview; offchain callers simulating another user should use {previewWithdrawFor}.
    function previewWithdraw(uint256 doubAmount) external view returns (uint256 userOut, uint256 feeToProtocol) {
        (userOut, feeToProtocol,,) = _previewWithdraw(doubAmount, msg.sender);
    }

    /// @notice Same as {previewWithdraw} but with an explicit user (cooldown applies to `user`).
    function previewWithdrawFor(address user, uint256 doubAmount)
        external
        view
        returns (uint256 userOut, uint256 feeToProtocol)
    {
        (userOut, feeToProtocol,,) = _previewWithdraw(doubAmount, user);
    }

    function _previewWithdraw(uint256 doubAmount, address user)
        internal
        view
        returns (uint256 userOut, uint256 feeToProtocol, uint256 grossFromRedeemable, uint256 effWad)
    {
        if (doubAmount == 0) return (0, 0, 0, WAD);
        uint256 supply = doub.totalSupply();
        require(supply > 0, "RT: zero supply");

        uint256 nominalOut = Math.mulDiv(doubAmount, eWad, WAD);
        uint256 proRataCap = Math.mulDiv(doubAmount, redeemableBacking, supply);
        uint256 baseOut = Math.min(nominalOut, proRataCap);

        uint256 h = redemptionHealthWad();
        effWad = minRedemptionEfficiencyWad + Math.mulDiv(WAD - minRedemptionEfficiencyWad, h, WAD);
        grossFromRedeemable = Math.mulDiv(baseOut, effWad, WAD);

        feeToProtocol = Math.mulDiv(grossFromRedeemable, withdrawFeeWad, WAD);
        userOut = grossFromRedeemable - feeToProtocol;

        if (redemptionCooldownEpochs > 0 && lastWithdrawEpochId[user] != 0) {
            if (currentEpochId < lastWithdrawEpochId[user] + redemptionCooldownEpochs) {
                userOut = 0;
                feeToProtocol = 0;
                grossFromRedeemable = 0;
            }
        }
    }

    // ── Epoch management ───────────────────────────────────────────────

    /// @notice Open the first epoch. Called once after deployment.
    function openFirstEpoch() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(currentEpochId == 0 && epochStart == 0, "RT: epoch exists");
        currentEpochId = 1;
        epochStart = block.timestamp;
        epochEnd = block.timestamp + epochDuration;
        emit BurrowEpochOpened(1, epochStart, epochEnd);
    }

    /// @notice Finalize the current epoch and open the next one.
    /// @dev `epochId` advances a rolling accounting window (snapshots, repricing, withdrawal cooldown indexing),
    ///      not a separate product "Epoch 2" roadmap stage (see `docs/product/rabbit-treasury.md`, GitLab #119).
    ///      Applies BurrowMath repricing using **total** backing (redeemable + protocol) for coverage.
    function finalizeEpoch() external {
        require(currentEpochId > 0, "RT: no epoch");
        require(block.timestamp >= epochEnd, "RT: epoch not ended");

        uint256 supply = doub.totalSupply();
        uint256 priorE = eWad;
        uint256 R = redeemableBacking + protocolOwnedBacking;

        // Coverage, multiplier, and repricing step
        uint256 C = supply > 0 ? BurrowMath.coverageWad(R, supply, eWad, cMaxWad, eps) : cMaxWad;
        uint256 m = BurrowMath.multiplierWad(C, cStarWad, alphaWad, betaWad, mMinWad, mMaxWad);
        uint256 nextE = supply > 0 ? BurrowMath.nextEWad(eWad, m, lamWad, deltaMaxFracWad) : eWad;

        uint256 repricingFactor = nextE > 0 ? Math.mulDiv(nextE, WAD, priorE) : WAD;
        uint256 reserveRatio =
            supply > 0 ? Math.mulDiv(R, WAD, Math.mulDiv(supply, nextE, WAD) + eps) : type(uint256).max;
        uint256 backingPerDoub = supply > 0 ? Math.mulDiv(R, WAD, supply) : 0;

        eWad = nextE;

        emit BurrowRepricingApplied(currentEpochId, repricingFactor, priorE, nextE);
        emit BurrowEpochReserveSnapshot(currentEpochId, address(reserveAsset), R);
        emit BurrowReserveBuckets(currentEpochId, redeemableBacking, protocolOwnedBacking, R);
        emit BurrowHealthEpochFinalized(
            currentEpochId, block.timestamp, reserveRatio, supply, repricingFactor, backingPerDoub, nextE
        );

        // Open next epoch
        currentEpochId += 1;
        epochStart = block.timestamp;
        epochEnd = block.timestamp + epochDuration;
        emit BurrowEpochOpened(currentEpochId, epochStart, epochEnd);
    }

    // ── User actions ───────────────────────────────────────────────────

    /// @notice Deposit reserve asset and receive DOUB at current exchange rate. Increases **redeemable** backing only.
    function deposit(uint256 amount, uint256 factionId) external whenNotPaused {
        require(currentEpochId > 0, "RT: no epoch");
        require(amount > 0, "RT: zero amount");

        uint256 balBefore = reserveAsset.balanceOf(address(this));
        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = reserveAsset.balanceOf(address(this)) - balBefore;
        require(received == amount, "RT: ERC20 parity");
        redeemableBacking += received;

        uint256 doubOut = Math.mulDiv(received, WAD, eWad);
        doub.mint(msg.sender, doubOut);

        uint256 total = redeemableBacking + protocolOwnedBacking;
        emit BurrowReserveBalanceUpdated(address(reserveAsset), total, int256(received), REASON_DEPOSIT);
        emit BurrowReserveBuckets(currentEpochId, redeemableBacking, protocolOwnedBacking, total);
        emit BurrowDeposited(msg.sender, address(reserveAsset), received, doubOut, currentEpochId, factionId);
    }

    /// @notice Burn DOUB and withdraw reserve from **redeemable** backing only, with pro-rata cap,
    ///         health-aware efficiency, optional cooldown, and withdrawal fee to protocol bucket.
    /// @dev TODO GitLab #70 — CL8Y outflow policy: `withdraw` is a public user redemption path; defer stricter owner/admin
    ///      alignment with `docs/onchain/cl8y-flow-audit.md` until product signs off on Burrow exceptions.
    function withdraw(uint256 doubAmount, uint256 factionId) external whenNotPaused {
        require(currentEpochId > 0, "RT: no epoch");
        require(doubAmount > 0, "RT: zero amount");

        if (redemptionCooldownEpochs > 0) {
            require(
                lastWithdrawEpochId[msg.sender] == 0
                    || currentEpochId >= lastWithdrawEpochId[msg.sender] + redemptionCooldownEpochs,
                "RT: redemption cooldown"
            );
        }

        (uint256 userOut, uint256 feeToProtocol, uint256 grossFromRedeemable,) =
            _previewWithdraw(doubAmount, msg.sender);
        require(userOut > 0, "RT: zero payout");

        require(grossFromRedeemable <= redeemableBacking, "RT: redeemable underflow");

        doub.burn(msg.sender, doubAmount);
        redeemableBacking -= grossFromRedeemable;
        protocolOwnedBacking += feeToProtocol;
        reserveAsset.safeTransfer(msg.sender, userOut);

        lastWithdrawEpochId[msg.sender] = currentEpochId;
        cumulativeWithdrawFees += feeToProtocol;

        uint256 total = redeemableBacking + protocolOwnedBacking;
        emit BurrowReserveBalanceUpdated(address(reserveAsset), total, -int256(userOut), REASON_WITHDRAW);
        if (feeToProtocol > 0) {
            emit BurrowWithdrawalFeeAccrued(address(reserveAsset), feeToProtocol, cumulativeWithdrawFees);
        }
        emit BurrowReserveBuckets(currentEpochId, redeemableBacking, protocolOwnedBacking, total);
        emit BurrowWithdrawn(msg.sender, address(reserveAsset), userOut, doubAmount, currentEpochId, factionId);
    }

    /// @notice Receive fee income from fee router: split burn / protocol bucket; no DOUB minted.
    /// @dev TODO GitLab #70 — CL8Y outflow policy: burn leg + protocol bucket booking is role-gated, not owner-timed;
    ///      defer explicit approved-exception docs vs `FeeRouter` routing until treasury audit follow-up.
    function receiveFee(uint256 amount) external onlyRole(FEE_ROUTER_ROLE) {
        require(amount > 0, "RT: zero fee");
        uint256 balBefore = reserveAsset.balanceOf(address(this));
        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);
        uint256 received = reserveAsset.balanceOf(address(this)) - balBefore;
        require(received == amount, "RT: ERC20 parity");

        uint256 burned = Math.mulDiv(received, protocolRevenueBurnShareWad, WAD);
        uint256 toProtocol = received - burned;

        cumulativeFees += received;
        cumulativeBurned += burned;
        protocolOwnedBacking += toProtocol;

        if (burned > 0) {
            reserveAsset.safeTransfer(burnSink, burned);
        }

        uint256 total = redeemableBacking + protocolOwnedBacking;
        int256 netDelta = int256(received) - int256(burned);
        emit BurrowReserveBalanceUpdated(address(reserveAsset), total, netDelta, REASON_FEE);
        emit BurrowFeeAccrued(address(reserveAsset), received, cumulativeFees, currentEpochId);
        emit BurrowProtocolRevenueSplit(currentEpochId, received, toProtocol, burned);
        emit BurrowReserveBuckets(currentEpochId, redeemableBacking, protocolOwnedBacking, total);
    }

    // ── Pause ──────────────────────────────────────────────────────────

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ── Parameter updates (governed) ───────────────────────────────────

    /// @param val Coverage pivot `c*` (WAD); must satisfy `0 < val <= cMaxWad` (GitLab #119).
    function setCStarWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val > 0 && val <= cMaxWad, "RT: cStar");
        emit ParamsUpdated(msg.sender, "cStarWad", cStarWad, val);
        cStarWad = val;
    }

    /// @param val Tanh strength `α` (WAD); must satisfy `val < WAD` so `BurrowMath.multiplierWad` never hits `inner<=0` via governance alone.
    function setAlphaWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val < WAD, "RT: alpha");
        emit ParamsUpdated(msg.sender, "alphaWad", alphaWad, val);
        alphaWad = val;
    }

    /// @param val Curve steepness `β` (WAD); must satisfy `0 < val <= MAX_BURROW_BETA_WAD`.
    function setBetaWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val > 0 && val <= MAX_BURROW_BETA_WAD, "RT: beta");
        emit ParamsUpdated(msg.sender, "betaWad", betaWad, val);
        betaWad = val;
    }

    function setMBoundsWad(uint256 _mMin, uint256 _mMax) external onlyRole(PARAMS_ROLE) {
        require(_mMin < _mMax, "RT: mMin >= mMax");
        emit ParamsUpdated(msg.sender, "mMinWad", mMinWad, _mMin);
        emit ParamsUpdated(msg.sender, "mMaxWad", mMaxWad, _mMax);
        mMinWad = _mMin;
        mMaxWad = _mMax;
    }

    /// @param val Smoothing `λ` (WAD); must satisfy `0 < val <= WAD`.
    function setLamWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val > 0 && val <= WAD, "RT: lam");
        emit ParamsUpdated(msg.sender, "lamWad", lamWad, val);
        lamWad = val;
    }

    /// @param val Per-step relative cap on `|Δe|` (WAD); must satisfy `0 < val <= MAX_BURROW_DELTA_MAX_FRAC_WAD`.
    function setDeltaMaxFracWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val > 0 && val <= MAX_BURROW_DELTA_MAX_FRAC_WAD, "RT: deltaMax");
        emit ParamsUpdated(msg.sender, "deltaMaxFracWad", deltaMaxFracWad, val);
        deltaMaxFracWad = val;
    }

    function setProtocolRevenueBurnShareWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val < WAD, "RT: burn share >= 100%");
        emit ParamsUpdated(msg.sender, "protocolRevenueBurnShareWad", protocolRevenueBurnShareWad, val);
        protocolRevenueBurnShareWad = val;
    }

    function setWithdrawFeeWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val < WAD, "RT: withdraw fee >= 100%");
        emit ParamsUpdated(msg.sender, "withdrawFeeWad", withdrawFeeWad, val);
        withdrawFeeWad = val;
    }

    function setMinRedemptionEfficiencyWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        require(val > 0 && val <= WAD, "RT: min eff");
        emit ParamsUpdated(msg.sender, "minRedemptionEfficiencyWad", minRedemptionEfficiencyWad, val);
        minRedemptionEfficiencyWad = val;
    }

    function setRedemptionCooldownEpochs(uint256 val) external onlyRole(PARAMS_ROLE) {
        emit ParamsUpdated(msg.sender, "redemptionCooldownEpochs", redemptionCooldownEpochs, val);
        redemptionCooldownEpochs = val;
    }

    uint256[50] private __gap;
}

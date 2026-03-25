// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {BurrowMath} from "./libraries/BurrowMath.sol";
import {Doubloon} from "./tokens/Doubloon.sol";

/// @title RabbitTreasury (Burrow)
/// @notice Player-facing reserve game: USDm deposits → DOUB mint, DOUB burn → USDm withdrawal,
///         epoch-based repricing via BurrowMath. Canonical Burrow* events per
///         docs/product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events.
contract RabbitTreasury is AccessControlEnumerable, Pausable {
    using SafeERC20 for IERC20;

    uint256 internal constant WAD = 1e18;

    // ── Roles ──────────────────────────────────────────────────────────
    bytes32 public constant FEE_ROUTER_ROLE = keccak256("FEE_ROUTER");
    bytes32 public constant PARAMS_ROLE = keccak256("PARAMS");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER");

    // ── Assets ─────────────────────────────────────────────────────────
    IERC20 public immutable reserveAsset;
    Doubloon public immutable doub;

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
    uint256 public totalReserves;

    // ── Reason codes for BurrowReserveBalanceUpdated ────────────────────
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
        address indexed reserveAsset,
        uint256 balanceAfter,
        int256 delta,
        uint8 reasonCode
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
    event BurrowFeeAccrued(
        address indexed asset,
        uint256 amount,
        uint256 cumulativeInAsset,
        uint256 indexed epochId
    );
    event BurrowRepricingApplied(
        uint256 indexed epochId,
        uint256 repricingFactorWad,
        uint256 priorInternalPriceWad,
        uint256 newInternalPriceWad
    );
    event ParamsUpdated(address indexed actor, string paramName, uint256 oldValue, uint256 newValue);

    uint256 public cumulativeFees;

    constructor(
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
        address admin
    ) {
        require(address(_reserveAsset) != address(0), "RT: zero reserve");
        require(address(_doub) != address(0), "RT: zero doub");
        require(_epochDuration > 0, "RT: zero epoch");

        reserveAsset = _reserveAsset;
        doub = _doub;
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

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PARAMS_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
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
    ///         Applies BurrowMath repricing.
    function finalizeEpoch() external {
        require(currentEpochId > 0, "RT: no epoch");
        require(block.timestamp >= epochEnd, "RT: epoch not ended");

        uint256 supply = doub.totalSupply();
        uint256 priorE = eWad;

        // Coverage, multiplier, and repricing step
        uint256 C = supply > 0
            ? BurrowMath.coverageWad(totalReserves, supply, eWad, cMaxWad, eps)
            : cMaxWad;
        uint256 m = BurrowMath.multiplierWad(C, cStarWad, alphaWad, betaWad, mMinWad, mMaxWad);
        uint256 nextE = supply > 0
            ? BurrowMath.nextEWad(eWad, m, lamWad, deltaMaxFracWad)
            : eWad;

        uint256 repricingFactor = nextE > 0 ? Math.mulDiv(nextE, WAD, priorE) : WAD;
        uint256 reserveRatio = supply > 0
            ? Math.mulDiv(totalReserves, WAD, Math.mulDiv(supply, nextE, WAD) + eps)
            : type(uint256).max;
        uint256 backingPerDoub = supply > 0
            ? Math.mulDiv(totalReserves, WAD, supply)
            : 0;

        eWad = nextE;

        emit BurrowRepricingApplied(currentEpochId, repricingFactor, priorE, nextE);
        emit BurrowEpochReserveSnapshot(currentEpochId, address(reserveAsset), totalReserves);
        emit BurrowHealthEpochFinalized(
            currentEpochId,
            block.timestamp,
            reserveRatio,
            supply,
            repricingFactor,
            backingPerDoub,
            nextE
        );

        // Open next epoch
        currentEpochId += 1;
        epochStart = block.timestamp;
        epochEnd = block.timestamp + epochDuration;
        emit BurrowEpochOpened(currentEpochId, epochStart, epochEnd);
    }

    // ── User actions ───────────────────────────────────────────────────

    /// @notice Deposit reserve asset and receive DOUB at current exchange rate.
    /// @param amount Reserve asset amount to deposit.
    /// @param factionId Faction identifier for leaderboard tracking (0 if none).
    function deposit(uint256 amount, uint256 factionId) external whenNotPaused {
        require(currentEpochId > 0, "RT: no epoch");
        require(amount > 0, "RT: zero amount");

        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);
        totalReserves += amount;

        uint256 doubOut = Math.mulDiv(amount, WAD, eWad);
        doub.mint(msg.sender, doubOut);

        emit BurrowReserveBalanceUpdated(
            address(reserveAsset),
            totalReserves,
            int256(amount),
            REASON_DEPOSIT
        );
        emit BurrowDeposited(msg.sender, address(reserveAsset), amount, doubOut, currentEpochId, factionId);
    }

    /// @notice Burn DOUB and withdraw reserve asset at current exchange rate.
    /// @param doubAmount Amount of DOUB to burn.
    /// @param factionId Faction identifier for leaderboard tracking (0 if none).
    function withdraw(uint256 doubAmount, uint256 factionId) external whenNotPaused {
        require(currentEpochId > 0, "RT: no epoch");
        require(doubAmount > 0, "RT: zero amount");

        uint256 reserveOut = Math.mulDiv(doubAmount, eWad, WAD);
        require(reserveOut <= totalReserves, "RT: insufficient reserves");

        doub.burn(msg.sender, doubAmount);
        totalReserves -= reserveOut;
        reserveAsset.safeTransfer(msg.sender, reserveOut);

        emit BurrowReserveBalanceUpdated(
            address(reserveAsset),
            totalReserves,
            -int256(reserveOut),
            REASON_WITHDRAW
        );
        emit BurrowWithdrawn(msg.sender, address(reserveAsset), reserveOut, doubAmount, currentEpochId, factionId);
    }

    /// @notice Receive fee income from fee router (increases reserves without minting DOUB).
    function receiveFee(uint256 amount) external onlyRole(FEE_ROUTER_ROLE) {
        require(amount > 0, "RT: zero fee");
        reserveAsset.safeTransferFrom(msg.sender, address(this), amount);
        totalReserves += amount;
        cumulativeFees += amount;

        emit BurrowReserveBalanceUpdated(
            address(reserveAsset),
            totalReserves,
            int256(amount),
            REASON_FEE
        );
        emit BurrowFeeAccrued(address(reserveAsset), amount, cumulativeFees, currentEpochId);
    }

    // ── Pause ──────────────────────────────────────────────────────────

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // ── Parameter updates (governed) ───────────────────────────────────

    function setCStarWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        emit ParamsUpdated(msg.sender, "cStarWad", cStarWad, val);
        cStarWad = val;
    }

    function setAlphaWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        emit ParamsUpdated(msg.sender, "alphaWad", alphaWad, val);
        alphaWad = val;
    }

    function setBetaWad(uint256 val) external onlyRole(PARAMS_ROLE) {
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

    function setLamWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        emit ParamsUpdated(msg.sender, "lamWad", lamWad, val);
        lamWad = val;
    }

    function setDeltaMaxFracWad(uint256 val) external onlyRole(PARAMS_ROLE) {
        emit ParamsUpdated(msg.sender, "deltaMaxFracWad", deltaMaxFracWad, val);
        deltaMaxFracWad = val;
    }
}

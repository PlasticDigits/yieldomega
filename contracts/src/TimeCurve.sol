// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TimeMath} from "./libraries/TimeMath.sol";
import {FeeRouter} from "./FeeRouter.sol";
import {PodiumPool} from "./sinks/PodiumPool.sol";
import {IReferralRegistry} from "./interfaces/IReferralRegistry.sol";

/// @title TimeCurve — token launch primitive
/// @notice Sale lifecycle per docs/product/primitives.md and docs/onchain/fee-routing-and-governance.md:
///         continuous min charm price growth, per-tx cap, timer extension, reserve-asset podium payouts,
///         CHARM-weighted DOUB redemption after sale.
/// @dev Referral rewards are **CHARM weight** (not reserve transfers). The full gross `amount` is routed
///      through `FeeRouter`; `redeemCharms` clears DOUB pro-rata to `totalCharmWeight`.
contract TimeCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Podium categories (see docs/product/primitives.md). Indices 0–3 only.
    uint8 public constant CAT_LAST_BUYERS = 0;
    uint8 public constant CAT_MOST_BUYS = 1;
    uint8 public constant CAT_BIGGEST_BUY = 2;
    uint8 public constant CAT_HIGHEST_CUMULATIVE = 3;
    uint8 public constant NUM_PODIUM_CATEGORIES = 4;

    /// @notice Referral: 10% of gross buy accrues as CHARM to referrer + 10% to referee (bps each).
    uint16 public constant REFERRAL_EACH_BPS = 1000;

    // ── Configuration (immutable after deploy) ─────────────────────────
    IERC20 public immutable acceptedAsset;
    IERC20 public immutable launchedToken;
    FeeRouter public immutable feeRouter;
    PodiumPool public immutable podiumPool;
    /// @notice Zero address disables `buy(amount, codeHash)` referral path.
    IReferralRegistry public immutable referralRegistry;

    uint256 public immutable initialMinBuy;
    uint256 public immutable growthRateWad;
    uint256 public immutable purchaseCapMultiple;
    uint256 public immutable timerExtensionSec;
    uint256 public immutable initialTimerSec;
    uint256 public immutable timerCapSec;
    uint256 public immutable totalTokensForSale;

    // ── Sale state ─────────────────────────────────────────────────────
    uint256 public saleStart;
    uint256 public deadline;
    uint256 public totalRaised;
    /// @notice Sum of all CHARM weight minted (spend + referral bonuses). Redemption denominator.
    uint256 public totalCharmWeight;
    bool public ended;
    bool public prizesDistributed;

    // ── Per-user tracking ──────────────────────────────────────────────
    mapping(address => uint256) public charmWeight;
    mapping(address => uint256) public buyCount;
    mapping(address => uint256) public biggestSingleBuy;
    mapping(address => bool) public charmsRedeemed;

    // ── Podium tracking ────────────────────────────────────────────────
    struct Podium {
        address[3] winners;
        uint256[3] values;
    }

    Podium[NUM_PODIUM_CATEGORIES] internal _podiums;

    address[3] internal _lastBuyers;
    uint8 internal _lastBuyerIdx;
    uint256 internal _totalBuys;

    // ── Events ─────────────────────────────────────────────────────────
    event SaleStarted(uint256 startTimestamp, uint256 initialDeadline, uint256 totalTokensForSale);
    event Buy(
        address indexed buyer,
        uint256 amount,
        uint256 currentMinBuy,
        uint256 newDeadline,
        uint256 totalRaisedAfter,
        uint256 buyIndex
    );
    event SaleEnded(uint256 endTimestamp, uint256 totalRaised, uint256 totalBuys);
    event CharmsRedeemed(address indexed buyer, uint256 tokenAmount);
    event PrizesDistributed();
    event ReferralApplied(
        address indexed buyer,
        address indexed referrer,
        bytes32 indexed codeHash,
        uint256 referrerCharmAdded,
        uint256 refereeCharmAdded,
        uint256 grossAmountRoutedToFeeRouter
    );

    constructor(
        IERC20 _acceptedAsset,
        IERC20 _launchedToken,
        FeeRouter _feeRouter,
        PodiumPool _podiumPool,
        address _referralRegistry,
        uint256 _initialMinBuy,
        uint256 _growthRateWad,
        uint256 _purchaseCapMultiple,
        uint256 _timerExtensionSec,
        uint256 _initialTimerSec,
        uint256 _timerCapSec,
        uint256 _totalTokensForSale
    ) {
        require(address(_acceptedAsset) != address(0), "TimeCurve: zero asset");
        require(address(_launchedToken) != address(0), "TimeCurve: zero launched token");
        require(address(_feeRouter) != address(0), "TimeCurve: zero router");
        require(address(_podiumPool) != address(0), "TimeCurve: zero podium pool");
        require(_initialMinBuy > 0, "TimeCurve: zero minBuy");
        require(_purchaseCapMultiple >= 2, "TimeCurve: capMultiple < 2");
        require(_timerExtensionSec > 0, "TimeCurve: zero extension");
        require(_initialTimerSec > 0, "TimeCurve: zero initial timer");
        require(_timerCapSec >= _timerExtensionSec, "TimeCurve: cap < extension");
        require(_timerCapSec >= _initialTimerSec, "TimeCurve: cap < initial timer");
        require(_totalTokensForSale > 0, "TimeCurve: zero tokens");

        acceptedAsset = _acceptedAsset;
        launchedToken = _launchedToken;
        feeRouter = _feeRouter;
        podiumPool = _podiumPool;
        initialMinBuy = _initialMinBuy;
        growthRateWad = _growthRateWad;
        purchaseCapMultiple = _purchaseCapMultiple;
        timerExtensionSec = _timerExtensionSec;
        initialTimerSec = _initialTimerSec;
        timerCapSec = _timerCapSec;
        totalTokensForSale = _totalTokensForSale;
        referralRegistry = IReferralRegistry(_referralRegistry);
    }

    function startSale() external {
        require(saleStart == 0, "TimeCurve: already started");
        require(
            launchedToken.balanceOf(address(this)) >= totalTokensForSale,
            "TimeCurve: insufficient launched tokens"
        );
        saleStart = block.timestamp;
        deadline = block.timestamp + initialTimerSec;
        emit SaleStarted(block.timestamp, deadline, totalTokensForSale);
    }

    function buy(uint256 amount) external nonReentrant {
        _buy(amount, bytes32(0));
    }

    function buy(uint256 amount, bytes32 codeHash) external nonReentrant {
        _buy(amount, codeHash);
    }

    function _buy(uint256 amount, bytes32 codeHash) internal {
        require(saleStart > 0, "TimeCurve: not started");
        require(!ended, "TimeCurve: ended");
        require(block.timestamp < deadline, "TimeCurve: timer expired");

        uint256 elapsed = block.timestamp - saleStart;
        uint256 minBuy = TimeMath.currentMinBuy(initialMinBuy, growthRateWad, elapsed);
        uint256 maxBuy = minBuy * purchaseCapMultiple;

        require(amount >= minBuy, "TimeCurve: below min charm price");
        require(amount <= maxBuy, "TimeCurve: above cap");

        if (codeHash != bytes32(0)) {
            require(address(referralRegistry) != address(0), "TimeCurve: referral disabled");
        }

        acceptedAsset.safeTransferFrom(msg.sender, address(this), amount);

        if (codeHash != bytes32(0)) {
            address referrer = referralRegistry.ownerOfCode(codeHash);
            require(referrer != address(0), "TimeCurve: invalid referral");
            require(referrer != msg.sender, "TimeCurve: self-referral");
            uint256 refEach = (amount * uint256(REFERRAL_EACH_BPS)) / 10_000;
            require(refEach > 0 && refEach * 2 <= amount, "TimeCurve: referral amount");
            charmWeight[referrer] += refEach;
            charmWeight[msg.sender] += refEach;
            totalCharmWeight += refEach * 2;
            emit ReferralApplied(msg.sender, referrer, codeHash, refEach, refEach, amount);
        }

        charmWeight[msg.sender] += amount;
        totalCharmWeight += amount;

        acceptedAsset.safeTransfer(address(feeRouter), amount);
        feeRouter.distributeFees(acceptedAsset, amount);

        totalRaised += amount;
        buyCount[msg.sender] += 1;
        _totalBuys += 1;

        deadline = TimeMath.extendDeadline(deadline, block.timestamp, timerExtensionSec, timerCapSec);

        _trackLastBuyer(msg.sender);
        _updateTopThree(CAT_MOST_BUYS, msg.sender, buyCount[msg.sender]);
        if (amount > biggestSingleBuy[msg.sender]) {
            biggestSingleBuy[msg.sender] = amount;
        }
        _updateTopThree(CAT_BIGGEST_BUY, msg.sender, biggestSingleBuy[msg.sender]);
        _updateTopThree(CAT_HIGHEST_CUMULATIVE, msg.sender, charmWeight[msg.sender]);

        emit Buy(msg.sender, amount, minBuy, deadline, totalRaised, _totalBuys);
    }

    function endSale() external {
        require(saleStart > 0, "TimeCurve: not started");
        require(!ended, "TimeCurve: already ended");
        require(block.timestamp >= deadline, "TimeCurve: timer not expired");
        ended = true;
        _finalizeLastBuyers();
        emit SaleEnded(block.timestamp, totalRaised, _totalBuys);
    }

    function redeemCharms() external nonReentrant {
        require(ended, "TimeCurve: not ended");
        require(charmWeight[msg.sender] > 0, "TimeCurve: no charm weight");
        require(!charmsRedeemed[msg.sender], "TimeCurve: already redeemed");
        require(totalCharmWeight > 0, "TimeCurve: zero charm supply");
        charmsRedeemed[msg.sender] = true;

        uint256 tokenOut = (totalTokensForSale * charmWeight[msg.sender]) / totalCharmWeight;
        require(tokenOut > 0, "TimeCurve: nothing to redeem");
        launchedToken.safeTransfer(msg.sender, tokenOut);
        emit CharmsRedeemed(msg.sender, tokenOut);
    }

    /// @notice Distribute **podium pool** reserves to winners (permissionless after `endSale`).
    /// @dev Category shares: 50% last buyers · 20% most buys · 10% biggest buy · 20% highest cumulative CHARM.
    ///      Within each category: 1st = 2× 2nd, 2nd = 2× 3rd (weights 4∶2∶1 on the slice).
    function distributePrizes() external {
        require(ended, "TimeCurve: not ended");
        require(!prizesDistributed, "TimeCurve: prizes done");

        uint256 prizePool = acceptedAsset.balanceOf(address(podiumPool));
        if (prizePool == 0) {
            return;
        }

        uint256 sLast = (prizePool * 50) / 100;
        uint256 sMost = (prizePool * 20) / 100;
        uint256 sBig = (prizePool * 10) / 100;
        uint256 sCum = prizePool - sLast - sMost - sBig;

        prizesDistributed = true;

        _payPodiumCategory(CAT_LAST_BUYERS, sLast);
        _payPodiumCategory(CAT_MOST_BUYS, sMost);
        _payPodiumCategory(CAT_BIGGEST_BUY, sBig);
        _payPodiumCategory(CAT_HIGHEST_CUMULATIVE, sCum);

        emit PrizesDistributed();
    }

    function _podiumSharesFromSlice(uint256 slice)
        internal
        pure
        returns (uint256 first, uint256 second, uint256 third)
    {
        first = (slice * 4) / 7;
        second = (slice * 2) / 7;
        third = slice - first - second;
    }

    function _payPodiumCategory(uint8 category, uint256 slice) internal {
        if (slice == 0) return;
        (uint256 sh0, uint256 sh1, uint256 sh2) = _podiumSharesFromSlice(slice);
        Podium storage p = _podiums[category];
        if (p.winners[0] != address(0) && sh0 > 0) {
            podiumPool.payPodiumPayout(acceptedAsset, p.winners[0], sh0, category, 0);
        }
        if (p.winners[1] != address(0) && sh1 > 0) {
            podiumPool.payPodiumPayout(acceptedAsset, p.winners[1], sh1, category, 1);
        }
        if (p.winners[2] != address(0) && sh2 > 0) {
            podiumPool.payPodiumPayout(acceptedAsset, p.winners[2], sh2, category, 2);
        }
    }

    function currentMinBuyAmount() external view returns (uint256) {
        if (saleStart == 0) return initialMinBuy;
        return TimeMath.currentMinBuy(initialMinBuy, growthRateWad, block.timestamp - saleStart);
    }

    function podium(uint8 category) external view returns (address[3] memory winners, uint256[3] memory values) {
        require(category < NUM_PODIUM_CATEGORIES, "TimeCurve: bad category");
        Podium storage p = _podiums[category];
        winners = p.winners;
        values = p.values;
    }

    function _trackLastBuyer(address buyer) internal {
        _lastBuyers[_lastBuyerIdx] = buyer;
        _lastBuyerIdx = (_lastBuyerIdx + 1) % 3;
    }

    function _finalizeLastBuyers() internal {
        Podium storage p = _podiums[CAT_LAST_BUYERS];
        uint256 buys = _totalBuys < 3 ? _totalBuys : 3;
        for (uint8 i; i < buys; ++i) {
            uint8 idx = uint8((_lastBuyerIdx + 2 - i) % 3);
            p.winners[i] = _lastBuyers[idx];
            p.values[i] = buys - i;
        }
    }

    function _updateTopThree(uint8 category, address candidate, uint256 candidateValue) internal {
        Podium storage p = _podiums[category];

        for (uint8 i; i < 3; ++i) {
            if (p.winners[i] == candidate) {
                p.values[i] = candidateValue;
                while (i > 0 && p.values[i] > p.values[i - 1]) {
                    (p.winners[i], p.winners[i - 1]) = (p.winners[i - 1], p.winners[i]);
                    (p.values[i], p.values[i - 1]) = (p.values[i - 1], p.values[i]);
                    --i;
                }
                return;
            }
        }

        if (candidateValue > p.values[2]) {
            p.winners[2] = candidate;
            p.values[2] = candidateValue;
            if (p.values[2] > p.values[1]) {
                (p.winners[2], p.winners[1]) = (p.winners[1], p.winners[2]);
                (p.values[2], p.values[1]) = (p.values[1], p.values[2]);
                if (p.values[1] > p.values[0]) {
                    (p.winners[1], p.winners[0]) = (p.winners[0], p.winners[1]);
                    (p.values[1], p.values[0]) = (p.values[0], p.values[1]);
                }
            }
        }
    }
}

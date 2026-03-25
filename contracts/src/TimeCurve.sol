// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TimeMath} from "./libraries/TimeMath.sol";
import {FeeRouter} from "./FeeRouter.sol";
import {PrizeVault} from "./sinks/PrizeVault.sol";
import {IReferralRegistry} from "./interfaces/IReferralRegistry.sol";

/// @title TimeCurve — token launch primitive
/// @notice Implements the sale lifecycle per docs/product/primitives.md:
///         continuous min-buy growth, per-tx cap, timer extension with cap,
///         deterministic prize podiums, proportional token allocation.
/// @dev Allocation model: each buyer's share = userSpend / totalRaised * totalTokensForSale.
///      Claimed after sale ends.
contract TimeCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Prize categories (minimum set from primitives.md) ──────────────
    uint8 public constant CAT_LAST_BUYERS = 0;
    uint8 public constant CAT_MOST_BUYS = 1;
    uint8 public constant CAT_BIGGEST_BUY = 2;
    uint8 public constant CAT_OPENING_WINDOW = 3;
    uint8 public constant CAT_CLOSING_WINDOW = 4;
    uint8 public constant CAT_HIGHEST_CUMULATIVE = 5;
    uint8 public constant NUM_CATEGORIES = 6;

    /// @notice Per docs/product/referrals.md: 10% to referrer + 10% referee rebate (bps each).
    uint16 public constant REFERRAL_EACH_BPS = 1000;

    // ── Configuration (immutable after deploy) ─────────────────────────
    IERC20 public immutable acceptedAsset;
    IERC20 public immutable launchedToken;
    FeeRouter public immutable feeRouter;
    PrizeVault public immutable prizeVault;
    /// @notice Zero address disables `buy(amount, codeHash)` referral path.
    IReferralRegistry public immutable referralRegistry;

    uint256 public immutable initialMinBuy;
    uint256 public immutable growthRateWad;
    uint256 public immutable purchaseCapMultiple;
    uint256 public immutable timerExtensionSec;
    uint256 public immutable timerCapSec;
    uint256 public immutable totalTokensForSale;
    uint256 public immutable openingWindowSec;
    uint256 public immutable closingWindowSec;

    // ── Sale state ─────────────────────────────────────────────────────
    uint256 public saleStart;
    uint256 public deadline;
    uint256 public totalRaised;
    bool public ended;
    bool public prizesDistributed;

    // ── Per-user tracking ──────────────────────────────────────────────
    mapping(address => uint256) public userSpend;
    mapping(address => uint256) public buyCount;
    mapping(address => uint256) public biggestSingleBuy;
    mapping(address => uint256) public closingWindowBuyCount;
    mapping(address => bool) public allocationClaimed;

    // ── Podium tracking ────────────────────────────────────────────────
    struct Podium {
        address[3] winners;
        uint256[3] values;
    }

    Podium[NUM_CATEGORIES] internal _podiums;

    // Opening window: first 3 buyers (by tx order)
    uint8 internal _openingCount;

    // Last buyers: circular buffer of last 3
    address[3] internal _lastBuyers;
    uint8 internal _lastBuyerIdx;
    uint256 internal _totalBuys;

    // ── Events (indexer-friendly per primitives.md) ────────────────────
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
    event AllocationClaimed(address indexed buyer, uint256 tokenAmount);
    event PrizesDistributed();
    event ReferralApplied(
        address indexed buyer,
        address indexed referrer,
        bytes32 indexed codeHash,
        uint256 referrerAmount,
        uint256 refereeAmount,
        uint256 amountToFeeRouter
    );

    constructor(
        IERC20 _acceptedAsset,
        IERC20 _launchedToken,
        FeeRouter _feeRouter,
        PrizeVault _prizeVault,
        address _referralRegistry,
        uint256 _initialMinBuy,
        uint256 _growthRateWad,
        uint256 _purchaseCapMultiple,
        uint256 _timerExtensionSec,
        uint256 _timerCapSec,
        uint256 _totalTokensForSale,
        uint256 _openingWindowSec,
        uint256 _closingWindowSec
    ) {
        require(address(_acceptedAsset) != address(0), "TimeCurve: zero asset");
        require(address(_launchedToken) != address(0), "TimeCurve: zero launched token");
        require(address(_feeRouter) != address(0), "TimeCurve: zero router");
        require(address(_prizeVault) != address(0), "TimeCurve: zero prize vault");
        require(_initialMinBuy > 0, "TimeCurve: zero minBuy");
        require(_purchaseCapMultiple >= 2, "TimeCurve: capMultiple < 2");
        require(_timerExtensionSec > 0, "TimeCurve: zero extension");
        require(_timerCapSec >= _timerExtensionSec, "TimeCurve: cap < extension");
        require(_totalTokensForSale > 0, "TimeCurve: zero tokens");

        acceptedAsset = _acceptedAsset;
        launchedToken = _launchedToken;
        feeRouter = _feeRouter;
        prizeVault = _prizeVault;
        initialMinBuy = _initialMinBuy;
        growthRateWad = _growthRateWad;
        purchaseCapMultiple = _purchaseCapMultiple;
        timerExtensionSec = _timerExtensionSec;
        timerCapSec = _timerCapSec;
        totalTokensForSale = _totalTokensForSale;
        openingWindowSec = _openingWindowSec;
        closingWindowSec = _closingWindowSec;
        referralRegistry = IReferralRegistry(_referralRegistry);
    }

    /// @notice Start the sale. Caller must have transferred launched tokens to this contract.
    function startSale() external {
        require(saleStart == 0, "TimeCurve: already started");
        require(
            launchedToken.balanceOf(address(this)) >= totalTokensForSale,
            "TimeCurve: insufficient launched tokens"
        );
        saleStart = block.timestamp;
        deadline = block.timestamp + timerCapSec;
        emit SaleStarted(block.timestamp, deadline, totalTokensForSale);
    }

    /// @notice Execute a buy during the active sale (no referral).
    /// @dev Assumes `acceptedAsset` behaves as a standard ERC20: `transferFrom` debits exactly `amount`
    ///      from the buyer. Fee-on-transfer or rebasing tokens are unsupported (`totalRaised` tracks `amount`).
    function buy(uint256 amount) external nonReentrant {
        _buy(amount, bytes32(0));
    }

    /// @notice Buy with an optional referral `codeHash` (see `ReferralRegistry.hashCode`).
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

        require(amount >= minBuy, "TimeCurve: below min buy");
        require(amount <= maxBuy, "TimeCurve: above cap");

        if (codeHash != bytes32(0)) {
            require(address(referralRegistry) != address(0), "TimeCurve: referral disabled");
        }

        acceptedAsset.safeTransferFrom(msg.sender, address(this), amount);

        uint256 toFee = amount;
        if (codeHash != bytes32(0)) {
            address referrer = referralRegistry.ownerOfCode(codeHash);
            require(referrer != address(0), "TimeCurve: invalid referral");
            require(referrer != msg.sender, "TimeCurve: self-referral");
            uint256 refEach = (amount * uint256(REFERRAL_EACH_BPS)) / 10_000;
            require(refEach > 0 && refEach * 2 <= amount, "TimeCurve: referral amount");
            toFee = amount - refEach * 2;
            acceptedAsset.safeTransfer(referrer, refEach);
            acceptedAsset.safeTransfer(msg.sender, refEach);
            emit ReferralApplied(msg.sender, referrer, codeHash, refEach, refEach, toFee);
        }

        acceptedAsset.safeTransfer(address(feeRouter), toFee);
        feeRouter.distributeFees(acceptedAsset, toFee);

        // Update state
        totalRaised += amount;
        userSpend[msg.sender] += amount;
        buyCount[msg.sender] += 1;
        _totalBuys += 1;

        // Timer extension
        deadline = TimeMath.extendDeadline(deadline, block.timestamp, timerExtensionSec, timerCapSec);

        // Prize category tracking
        _trackLastBuyer(msg.sender);
        _updateTopThree(CAT_MOST_BUYS, msg.sender, buyCount[msg.sender]);
        if (amount > biggestSingleBuy[msg.sender]) {
            biggestSingleBuy[msg.sender] = amount;
        }
        _updateTopThree(CAT_BIGGEST_BUY, msg.sender, biggestSingleBuy[msg.sender]);
        _updateTopThree(CAT_HIGHEST_CUMULATIVE, msg.sender, userSpend[msg.sender]);
        _trackOpeningWindow(msg.sender, elapsed);
        _trackClosingWindow(msg.sender);

        emit Buy(msg.sender, amount, minBuy, deadline, totalRaised, _totalBuys);
    }

    /// @notice Mark sale as ended once timer expires.
    function endSale() external {
        require(saleStart > 0, "TimeCurve: not started");
        require(!ended, "TimeCurve: already ended");
        require(block.timestamp >= deadline, "TimeCurve: timer not expired");
        ended = true;
        // Finalize last-buyers podium
        _finalizeLastBuyers();
        emit SaleEnded(block.timestamp, totalRaised, _totalBuys);
    }

    /// @notice Claim proportional token allocation after sale ends.
    function claimAllocation() external nonReentrant {
        require(ended, "TimeCurve: not ended");
        require(userSpend[msg.sender] > 0, "TimeCurve: no spend");
        require(!allocationClaimed[msg.sender], "TimeCurve: already claimed");
        allocationClaimed[msg.sender] = true;

        uint256 allocation = (totalTokensForSale * userSpend[msg.sender]) / totalRaised;
        require(allocation > 0, "TimeCurve: zero allocation");
        launchedToken.safeTransfer(msg.sender, allocation);
        emit AllocationClaimed(msg.sender, allocation);
    }

    /// @notice Distribute prizes from PrizeVault to podium winners.
    ///         Uses equal category weights and 50/30/20 podium split (governance-set defaults).
    /// @dev Permissionless call: anyone may trigger payout once the sale has ended.
    ///      If the vault is empty, per-category share rounds to zero for all podium places,
    ///      or the pool is otherwise too small to pay integer splits, this function returns
    ///      without setting `prizesDistributed` so a later call can succeed after more fees accrue.
    ///      Reentrancy: `payPrize` only transfers ERC20 to winners; no callback into TimeCurve is expected.
    function distributePrizes() external {
        require(ended, "TimeCurve: not ended");
        require(!prizesDistributed, "TimeCurve: prizes done");

        uint256 prizePool = acceptedAsset.balanceOf(address(prizeVault));
        if (prizePool == 0) {
            return;
        }

        // Equal weight per category (1/6 each)
        uint256 perCategory = prizePool / NUM_CATEGORIES;
        // Podium split: 50% / 30% / 20% of each category slice
        uint256 share0 = perCategory / 2;
        uint256 share1 = (perCategory * 30) / 100;
        uint256 share2 = (perCategory * 20) / 100;
        if (share0 == 0 && share1 == 0 && share2 == 0) {
            return;
        }

        prizesDistributed = true;
        uint256[3] memory podiumShares = [share0, share1, share2];

        for (uint8 cat; cat < NUM_CATEGORIES; ++cat) {
            Podium storage p = _podiums[cat];
            for (uint8 place; place < 3; ++place) {
                if (p.winners[place] != address(0) && podiumShares[place] > 0) {
                    prizeVault.payPrize(acceptedAsset, p.winners[place], podiumShares[place], cat, place);
                }
            }
        }
        emit PrizesDistributed();
    }

    // ── View helpers ───────────────────────────────────────────────────

    function currentMinBuyAmount() external view returns (uint256) {
        if (saleStart == 0) return initialMinBuy;
        return TimeMath.currentMinBuy(initialMinBuy, growthRateWad, block.timestamp - saleStart);
    }

    function podium(uint8 category) external view returns (address[3] memory winners, uint256[3] memory values) {
        Podium storage p = _podiums[category];
        winners = p.winners;
        values = p.values;
    }

    // ── Internal prize tracking ────────────────────────────────────────

    function _trackLastBuyer(address buyer) internal {
        _lastBuyers[_lastBuyerIdx] = buyer;
        _lastBuyerIdx = (_lastBuyerIdx + 1) % 3;
    }

    function _finalizeLastBuyers() internal {
        // _lastBuyers is circular; _lastBuyerIdx points to the oldest slot.
        // Most recent = (_lastBuyerIdx + 2) % 3, etc.
        Podium storage p = _podiums[CAT_LAST_BUYERS];
        uint256 buys = _totalBuys < 3 ? _totalBuys : 3;
        for (uint8 i; i < buys; ++i) {
            uint8 idx = uint8((_lastBuyerIdx + 2 - i) % 3);
            p.winners[i] = _lastBuyers[idx];
            p.values[i] = buys - i; // ordinal rank
        }
    }

    function _trackOpeningWindow(address buyer, uint256 elapsed) internal {
        if (_openingCount >= 3 || elapsed > openingWindowSec) return;
        Podium storage p = _podiums[CAT_OPENING_WINDOW];
        p.winners[_openingCount] = buyer;
        p.values[_openingCount] = _openingCount + 1;
        _openingCount += 1;
    }

    function _trackClosingWindow(address buyer) internal {
        uint256 remaining = deadline > block.timestamp ? deadline - block.timestamp : 0;
        if (remaining > closingWindowSec) return;
        closingWindowBuyCount[buyer] += 1;
        _updateTopThree(CAT_CLOSING_WINDOW, buyer, closingWindowBuyCount[buyer]);
    }

    /// @dev Maintain a top-3 leaderboard. Ties broken by temporal ordering
    ///      (the earlier buyer keeps their position — strict > for displacement).
    function _updateTopThree(uint8 category, address candidate, uint256 candidateValue) internal {
        Podium storage p = _podiums[category];

        // Check if candidate is already in podium
        for (uint8 i; i < 3; ++i) {
            if (p.winners[i] == candidate) {
                p.values[i] = candidateValue;
                // Bubble up
                while (i > 0 && p.values[i] > p.values[i - 1]) {
                    (p.winners[i], p.winners[i - 1]) = (p.winners[i - 1], p.winners[i]);
                    (p.values[i], p.values[i - 1]) = (p.values[i - 1], p.values[i]);
                    --i;
                }
                return;
            }
        }

        // Not in podium — check if qualifies (strictly greater than #3)
        if (candidateValue > p.values[2]) {
            p.winners[2] = candidate;
            p.values[2] = candidateValue;
            // Bubble up
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

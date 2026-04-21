// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TimeMath} from "./libraries/TimeMath.sol";
import {FeeRouter} from "./FeeRouter.sol";
import {PodiumPool} from "./sinks/PodiumPool.sol";
import {IReferralRegistry} from "./interfaces/IReferralRegistry.sol";
import {ICharmPrice} from "./interfaces/ICharmPrice.sol";

/// @title TimeCurve — token launch primitive + WarBow Ladder (PvP Battle Points)
/// @notice CHARM bounds × linear price; timer uses +2m extension, or **hard reset toward 15m remaining** when under 13m left
///         (see `TIMER_RESET_BELOW_REMAINING_SEC` / `TIMER_RESET_TO_REMAINING_SEC`). **Four** reserve podium categories:
///         last buy, WarBow (top Battle Points), defended streak, time booster — see `docs/product/primitives.md`.
///         WarBow steals, guard, revenge, and flag claim use separate burn mechanics — same contract.
contract TimeCurve is ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Reason codes for `WarBowCl8yBurned` (stable numeric values for indexers).
    enum WarBowBurnReason {
        Steal,
        StealLimitBypass,
        Revenge,
        Guard
    }

    // ── Prize podium categories (reserve payouts; four) ─────────────────
    uint8 public constant CAT_LAST_BUYERS = 0;
    uint8 public constant CAT_TIME_BOOSTER = 1;
    uint8 public constant CAT_DEFENDED_STREAK = 2;
    /// @notice Top **Battle Points** snapshot; paid from the WarBow slice of the podium pool (same leaderboard as `warbowLadderPodium()`).
    uint8 public constant CAT_WARBOW = 3;
    uint8 public constant NUM_PODIUM_CATEGORIES = 4;

    /// @notice Defended streak counts only when remaining time **before** buy is **strictly below** this (15 minutes).
    uint256 public constant DEFENDED_STREAK_WINDOW_SEC = 900;

    // ── Timer hard-reset band (13m → snap remaining toward 15m) ──────────
    /// @dev If remaining < this **before** buy, deadline snaps to `min(now + TIMER_RESET_TO_REMAINING_SEC, now + timerCapSec)`.
    uint256 public constant TIMER_RESET_BELOW_REMAINING_SEC = 780; // 13 minutes
    /// @notice Target remaining after hard-reset branch (15 minutes).
    uint256 public constant TIMER_RESET_TO_REMAINING_SEC = 900;

    // ── WarBow Ladder — Battle Points (defaults; document in primitives) ─
    uint256 public constant WARBOW_BASE_BUY_BP = 250;
    /// @notice Extra BP when the **hard timer reset** branch fires on a buy.
    uint256 public constant WARBOW_TIMER_RESET_BONUS_BP = 500;
    /// @notice Extra BP when remaining time before buy was under 30 seconds (“clutch”).
    uint256 public constant WARBOW_CLUTCH_BONUS_BP = 150;
    /// @notice Streak-break bonus for buyer = `priorActiveStreak * WARBOW_STREAK_BREAK_MULT_BP`.
    uint256 public constant WARBOW_STREAK_BREAK_MULT_BP = 100;
    /// @notice Extra BP when hard-reset **and** buyer breaks another wallet’s active defended streak this tx (“ambush”).
    uint256 public constant WARBOW_AMBUSH_BONUS_BP = 200;

    /// @notice Successful flag claim awards this BP; intervening buy penalizes former holder `2 *` this.
    uint256 public constant WARBOW_FLAG_CLAIM_BP = 1000;
    /// @notice Silence required after own buy before `claimWarBowFlag` (5 minutes).
    uint256 public constant WARBOW_FLAG_SILENCE_SEC = 300;

    uint256 public constant WARBOW_STEAL_BURN_WAD = 1e18;
    uint256 public constant WARBOW_REVENGE_BURN_WAD = 1e18;
    uint256 public constant WARBOW_GUARD_BURN_WAD = 10e18;
    uint256 public constant WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD = 50e18;
    uint256 public constant WARBOW_GUARD_DURATION_SEC = 6 hours;

    uint16 public constant WARBOW_STEAL_DRAIN_BPS = 1000; // 10%
    uint16 public constant WARBOW_STEAL_DRAIN_GUARDED_BPS = 100; // 1%
    uint8 public constant WARBOW_MAX_STEALS_PER_VICTIM_PER_DAY = 3;

    uint256 public constant SECONDS_PER_DAY = 86_400;
    uint256 public constant WARBOW_REVENGE_WINDOW_SEC = 24 hours;

    uint16 public constant REFERRAL_EACH_BPS = 1000;

    address internal constant BURN_SINK = 0x000000000000000000000000000000000000dEaD;

    uint256 internal constant WAD = 1e18;
    /// @dev 0.99e18 — on-chain floor vs 1.0 CHARM in UX so envelope drift during wallet signing does not revert min buys.
    uint256 internal constant CHARM_MIN_BASE_WAD = 99e16;
    /// @dev 10e18 — max CHARM per buy is 10× the nominal 1 CHARM unit at the same envelope scale.
    uint256 internal constant CHARM_MAX_BASE_WAD = 10e18;

    IERC20 public immutable acceptedAsset;
    IERC20 public immutable launchedToken;
    FeeRouter public immutable feeRouter;
    PodiumPool public immutable podiumPool;
    IReferralRegistry public immutable referralRegistry;
    ICharmPrice public immutable charmPrice;

    uint256 public immutable initialMinBuy;
    uint256 public immutable growthRateWad;
    uint256 public immutable timerExtensionSec;
    uint256 public immutable initialTimerSec;
    uint256 public immutable timerCapSec;
    uint256 public immutable totalTokensForSale;
    /// @notice Minimum seconds between successful `buy` calls from the same wallet (`block.timestamp` basis).
    uint256 public immutable buyCooldownSec;

    uint256 public saleStart;
    uint256 public deadline;
    uint256 public totalRaised;
    uint256 public totalCharmWeight;
    bool public ended;
    bool public prizesDistributed;

    mapping(address => uint256) public charmWeight;
    mapping(address => uint256) public buyCount;
    mapping(address => bool) public charmsRedeemed;
    /// @notice Unix epoch seconds when `buyer` may `buy` again; `0` means never bought (always eligible).
    mapping(address => uint256) public nextBuyAllowedAt;

    mapping(address => uint256) public totalEffectiveTimerSecAdded;
    /// @notice **WarBow Ladder** score (Battle Points); top-3 funded from the WarBow podium slice after `endSale`.
    mapping(address => uint256) public battlePoints;
    mapping(address => uint256) public bestDefendedStreak;
    mapping(address => uint256) public activeDefendedStreak;

    /// @notice Unix-day id `block.timestamp / 86400` → steals **received** by this victim that day.
    mapping(address => mapping(uint256 => uint8)) public stealsReceivedOnDay;

    /// @notice Guard reduces incoming steal % until this timestamp (exclusive).
    mapping(address => uint256) public warbowGuardUntil;

    /// @notice Last stealer for revenge (overwritten on each new steal **to** this victim).
    mapping(address => address) public warbowPendingRevengeStealer;
    /// @notice Inclusive upper bound for `warbowRevenge` (`< expiry` check).
    mapping(address => uint256) public warbowPendingRevengeExpiry;

    struct Podium {
        address[3] winners;
        uint256[3] values;
    }

    /// @dev Last buy (0), time booster (1), defended streak (2). WarBow uses `_warbowPodium` only.
    Podium[3] internal _podiums;
    /// @dev Top-3 **Battle Points** — reserve-funded via `CAT_WARBOW` slice in `distributePrizes`.
    Podium internal _warbowPodium;

    address[3] internal _lastBuyers;
    uint8 internal _lastBuyerIdx;
    uint256 internal _totalBuys;

    address internal _dsLastUnderWindowBuyer;

    address public warbowPendingFlagOwner;
    uint256 public warbowPendingFlagPlantAt;

    event SaleStarted(uint256 startTimestamp, uint256 initialDeadline, uint256 totalTokensForSale);
    event Buy(
        address indexed buyer,
        uint256 charmWad,
        uint256 amount,
        uint256 pricePerCharmWad,
        uint256 newDeadline,
        uint256 totalRaisedAfter,
        uint256 buyIndex,
        uint256 actualSecondsAdded,
        bool timerHardReset,
        uint256 battlePointsAfter,
        uint256 bpBaseBuy,
        uint256 bpTimerResetBonus,
        uint256 bpClutchBonus,
        uint256 bpStreakBreakBonus,
        uint256 bpAmbushBonus,
        uint256 bpFlagPenalty,
        bool flagPlanted,
        uint256 buyerTotalEffectiveTimerSecAdded,
        uint256 buyerActiveDefendedStreak,
        uint256 buyerBestDefendedStreak
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
    event WarBowSteal(
        address indexed attacker,
        address indexed victim,
        uint256 amountBp,
        uint256 burnPaidWad,
        bool bypassedVictimDailyLimit,
        uint256 victimBpAfter,
        uint256 attackerBpAfter
    );
    event WarBowRevenge(address indexed avenger, address indexed stealer, uint256 amountBp, uint256 burnPaidWad);
    event WarBowGuardActivated(address indexed player, uint256 guardUntilTs, uint256 burnPaidWad);
    event WarBowFlagClaimed(address indexed player, uint256 bonusBp, uint256 battlePointsAfter);
    event WarBowFlagPenalized(
        address indexed formerHolder,
        uint256 penaltyBp,
        address indexed triggeringBuyer,
        uint256 battlePointsAfter
    );
    /// @notice Accepted-asset burn to `BURN_SINK` for WarBow actions (uniform accounting).
    event WarBowCl8yBurned(address indexed payer, uint8 indexed reason, uint256 amountWad);
    event WarBowDefendedStreakContinued(
        address indexed wallet, uint256 activeStreak, uint256 bestStreak
    );
    event WarBowDefendedStreakBroken(
        address indexed formerHolder, address indexed interrupter, uint256 brokenActiveLength
    );
    event WarBowDefendedStreakWindowCleared(address indexed clearedWallet);

    constructor(
        IERC20 _acceptedAsset,
        IERC20 _launchedToken,
        FeeRouter _feeRouter,
        PodiumPool _podiumPool,
        address _referralRegistry,
        ICharmPrice _charmPrice,
        uint256 _charmEnvelopeRefWad,
        uint256 _growthRateWad,
        uint256 _timerExtensionSec,
        uint256 _initialTimerSec,
        uint256 _timerCapSec,
        uint256 _totalTokensForSale,
        uint256 _buyCooldownSec
    ) {
        require(address(_acceptedAsset) != address(0), "TimeCurve: zero asset");
        require(address(_launchedToken) != address(0), "TimeCurve: zero launched token");
        require(address(_feeRouter) != address(0), "TimeCurve: zero router");
        require(address(_podiumPool) != address(0), "TimeCurve: zero podium pool");
        require(address(_charmPrice) != address(0), "TimeCurve: zero charm price");
        require(_charmEnvelopeRefWad > 0, "TimeCurve: zero envelope ref");
        require(_timerExtensionSec > 0, "TimeCurve: zero extension");
        require(_initialTimerSec > 0, "TimeCurve: zero initial timer");
        require(_timerCapSec >= _timerExtensionSec, "TimeCurve: cap < extension");
        require(_timerCapSec >= _initialTimerSec, "TimeCurve: cap < initial timer");
        require(_totalTokensForSale > 0, "TimeCurve: zero tokens");
        require(_buyCooldownSec > 0, "TimeCurve: zero buy cooldown");
        acceptedAsset = _acceptedAsset;
        launchedToken = _launchedToken;
        feeRouter = _feeRouter;
        podiumPool = _podiumPool;
        charmPrice = _charmPrice;
        initialMinBuy = _charmEnvelopeRefWad;
        growthRateWad = _growthRateWad;
        timerExtensionSec = _timerExtensionSec;
        initialTimerSec = _initialTimerSec;
        timerCapSec = _timerCapSec;
        totalTokensForSale = _totalTokensForSale;
        buyCooldownSec = _buyCooldownSec;
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

    function buy(uint256 charmWad) external nonReentrant {
        _buy(charmWad, bytes32(0));
    }

    function buy(uint256 charmWad, bytes32 codeHash) external nonReentrant {
        _buy(charmWad, codeHash);
    }

    function _charmBounds(uint256 elapsed) internal view returns (uint256 minCharmWad, uint256 maxCharmWad) {
        uint256 scale = TimeMath.currentMinBuy(initialMinBuy, growthRateWad, elapsed);
        minCharmWad = Math.mulDiv(CHARM_MIN_BASE_WAD, scale, initialMinBuy);
        maxCharmWad = Math.mulDiv(CHARM_MAX_BASE_WAD, scale, initialMinBuy);
    }

    function _buy(uint256 charmWad, bytes32 codeHash) internal {
        require(saleStart > 0, "TimeCurve: not started");
        require(!ended, "TimeCurve: ended");
        require(block.timestamp < deadline, "TimeCurve: timer expired");
        require(block.timestamp >= nextBuyAllowedAt[msg.sender], "TimeCurve: buy cooldown");

        uint256 elapsed = block.timestamp - saleStart;
        (uint256 minCharm, uint256 maxCharm) = _charmBounds(elapsed);
        require(charmWad >= minCharm, "TimeCurve: below min charms");
        require(charmWad <= maxCharm, "TimeCurve: above max charms");

        uint256 priceWad = charmPrice.priceWad(elapsed);
        uint256 amount = Math.mulDiv(charmWad, priceWad, WAD);
        require(amount > 0, "TimeCurve: zero spend");

        if (codeHash != bytes32(0)) {
            require(address(referralRegistry) != address(0), "TimeCurve: referral disabled");
        }

        acceptedAsset.safeTransferFrom(msg.sender, address(this), amount);

        if (codeHash != bytes32(0)) {
            address referrer = referralRegistry.ownerOfCode(codeHash);
            require(referrer != address(0), "TimeCurve: invalid referral");
            require(referrer != msg.sender, "TimeCurve: self-referral");
            uint256 refEach = (charmWad * uint256(REFERRAL_EACH_BPS)) / 10_000;
            require(refEach > 0 && refEach * 2 <= charmWad, "TimeCurve: referral amount");
            charmWeight[referrer] += refEach;
            charmWeight[msg.sender] += refEach;
            totalCharmWeight += refEach * 2;
            emit ReferralApplied(msg.sender, referrer, codeHash, refEach, refEach, amount);
        }

        charmWeight[msg.sender] += charmWad;
        totalCharmWeight += charmWad;

        acceptedAsset.safeTransfer(address(feeRouter), amount);
        feeRouter.distributeFees(acceptedAsset, amount);

        totalRaised += amount;
        buyCount[msg.sender] += 1;
        _totalBuys += 1;

        uint256 deadlineBefore = deadline;
        uint256 remainingBeforeBuy = deadlineBefore - block.timestamp;

        // Flag: if another buyer snipes **after** the silence window (claim was available) before claim, penalize 2X.
        uint256 flagPenalty;
        if (warbowPendingFlagOwner != address(0) && msg.sender != warbowPendingFlagOwner) {
            if (block.timestamp >= warbowPendingFlagPlantAt + WARBOW_FLAG_SILENCE_SEC) {
                uint256 pen = WARBOW_FLAG_CLAIM_BP * 2;
                _subBattlePoints(warbowPendingFlagOwner, pen);
                flagPenalty = pen;
                emit WarBowFlagPenalized(
                    warbowPendingFlagOwner, pen, msg.sender, battlePoints[warbowPendingFlagOwner]
                );
            }
            warbowPendingFlagOwner = address(0);
            warbowPendingFlagPlantAt = 0;
        }

        (uint256 newDl, bool hardReset) = TimeMath.extendDeadlineOrResetBelowThreshold(
            deadlineBefore,
            block.timestamp,
            timerExtensionSec,
            timerCapSec,
            TIMER_RESET_BELOW_REMAINING_SEC,
            TIMER_RESET_TO_REMAINING_SEC
        );
        deadline = newDl;
        uint256 actualSecondsAdded = newDl - deadlineBefore;

        _trackLastBuyer(msg.sender);

        if (actualSecondsAdded > 0) {
            totalEffectiveTimerSecAdded[msg.sender] += actualSecondsAdded;
            _updateTopThreeMonotonic(CAT_TIME_BOOSTER, msg.sender, totalEffectiveTimerSecAdded[msg.sender]);
        }

        uint256 bpStreakBreak;
        uint256 bpAmbush;
        if (
            remainingBeforeBuy < DEFENDED_STREAK_WINDOW_SEC && _dsLastUnderWindowBuyer != address(0)
                && msg.sender != _dsLastUnderWindowBuyer
        ) {
            uint256 len = activeDefendedStreak[_dsLastUnderWindowBuyer];
            if (len > 0) {
                bpStreakBreak = len * WARBOW_STREAK_BREAK_MULT_BP;
                if (hardReset) {
                    bpAmbush = WARBOW_AMBUSH_BONUS_BP;
                }
            }
        }

        _processDefendedStreak(msg.sender, remainingBeforeBuy, actualSecondsAdded);

        uint256 bpBase = WARBOW_BASE_BUY_BP;
        uint256 bpReset;
        if (hardReset) {
            bpReset = WARBOW_TIMER_RESET_BONUS_BP;
        }
        uint256 bpClutch;
        if (remainingBeforeBuy < 30) {
            bpClutch = WARBOW_CLUTCH_BONUS_BP;
        }

        _addBattlePoints(msg.sender, bpBase + bpReset + bpClutch + bpStreakBreak + bpAmbush);

        warbowPendingFlagOwner = msg.sender;
        warbowPendingFlagPlantAt = block.timestamp;

        emit Buy(
            msg.sender,
            charmWad,
            amount,
            priceWad,
            deadline,
            totalRaised,
            _totalBuys,
            actualSecondsAdded,
            hardReset,
            battlePoints[msg.sender],
            bpBase,
            bpReset,
            bpClutch,
            bpStreakBreak,
            bpAmbush,
            flagPenalty,
            true,
            totalEffectiveTimerSecAdded[msg.sender],
            activeDefendedStreak[msg.sender],
            bestDefendedStreak[msg.sender]
        );

        nextBuyAllowedAt[msg.sender] = block.timestamp + buyCooldownSec;
    }

    /// @notice After **your** buy, wait `WARBOW_FLAG_SILENCE_SEC` with **no other buyer**; then claim **+WARBOW_FLAG_CLAIM_BP**.
    function claimWarBowFlag() external nonReentrant {
        require(saleStart > 0 && !ended, "TimeCurve: bad phase");
        require(warbowPendingFlagOwner == msg.sender, "TimeCurve: not flag holder");
        require(block.timestamp >= warbowPendingFlagPlantAt + WARBOW_FLAG_SILENCE_SEC, "TimeCurve: flag silence");

        warbowPendingFlagOwner = address(0);
        warbowPendingFlagPlantAt = 0;

        _addBattlePoints(msg.sender, WARBOW_FLAG_CLAIM_BP);
        emit WarBowFlagClaimed(msg.sender, WARBOW_FLAG_CLAIM_BP, battlePoints[msg.sender]);
    }

    /// @notice Burn **1 CL8Y** (accepted asset); steal **10%** (or **1%** if victim guarded) of victim’s BP. Victim must have **≥ 2×** your BP.
    /// @param payBypassBurn If victim already hit **3** steals today, pass `true` and pay **+50 CL8Y** to proceed.
    function warbowSteal(address victim, bool payBypassBurn) external nonReentrant {
        require(saleStart > 0 && !ended, "TimeCurve: bad phase");
        require(victim != address(0) && victim != msg.sender, "TimeCurve: bad victim");

        uint256 day = block.timestamp / SECONDS_PER_DAY;
        uint8 received = stealsReceivedOnDay[victim][day];
        acceptedAsset.safeTransferFrom(msg.sender, address(this), WARBOW_STEAL_BURN_WAD);
        emit WarBowCl8yBurned(msg.sender, uint8(WarBowBurnReason.Steal), WARBOW_STEAL_BURN_WAD);
        uint256 totalBurn = WARBOW_STEAL_BURN_WAD;
        if (received >= WARBOW_MAX_STEALS_PER_VICTIM_PER_DAY) {
            require(payBypassBurn, "TimeCurve: steal victim daily limit");
            acceptedAsset.safeTransferFrom(msg.sender, address(this), WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD);
            emit WarBowCl8yBurned(
                msg.sender, uint8(WarBowBurnReason.StealLimitBypass), WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD
            );
            totalBurn += WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD;
        }

        acceptedAsset.safeTransfer(BURN_SINK, totalBurn);

        uint256 vbp = battlePoints[victim];
        uint256 abp = battlePoints[msg.sender];
        require(vbp > 0 && vbp >= 2 * abp, "TimeCurve: steal 2x rule");

        uint16 bps = block.timestamp < warbowGuardUntil[victim] ? WARBOW_STEAL_DRAIN_GUARDED_BPS : WARBOW_STEAL_DRAIN_BPS;
        uint256 take = (vbp * uint256(bps)) / 10_000;
        require(take > 0, "TimeCurve: steal zero");

        _subBattlePoints(victim, take);
        _addBattlePoints(msg.sender, take);

        if (received < type(uint8).max) {
            stealsReceivedOnDay[victim][day] = received + 1;
        }

        warbowPendingRevengeStealer[victim] = msg.sender;
        warbowPendingRevengeExpiry[victim] = block.timestamp + WARBOW_REVENGE_WINDOW_SEC;

        emit WarBowSteal(
            msg.sender,
            victim,
            take,
            totalBurn,
            payBypassBurn && received >= WARBOW_MAX_STEALS_PER_VICTIM_PER_DAY,
            battlePoints[victim],
            battlePoints[msg.sender]
        );
    }

    /// @notice Within **24h** of `warbowSteal` **to you**, burn **1 CL8Y** and reclaim **floor(10%)** of **that stealer’s** BP once.
    function warbowRevenge(address stealer) external nonReentrant {
        require(saleStart > 0, "TimeCurve: not started");
        require(stealer != address(0), "TimeCurve: zero stealer");
        require(warbowPendingRevengeStealer[msg.sender] == stealer, "TimeCurve: revenge not pending");
        require(block.timestamp < warbowPendingRevengeExpiry[msg.sender], "TimeCurve: revenge expired");

        acceptedAsset.safeTransferFrom(msg.sender, address(this), WARBOW_REVENGE_BURN_WAD);
        emit WarBowCl8yBurned(msg.sender, uint8(WarBowBurnReason.Revenge), WARBOW_REVENGE_BURN_WAD);
        acceptedAsset.safeTransfer(BURN_SINK, WARBOW_REVENGE_BURN_WAD);

        uint256 sbp = battlePoints[stealer];
        uint256 take = (sbp * uint256(WARBOW_STEAL_DRAIN_BPS)) / 10_000;
        require(take > 0, "TimeCurve: revenge zero");

        _subBattlePoints(stealer, take);
        _addBattlePoints(msg.sender, take);

        warbowPendingRevengeStealer[msg.sender] = address(0);
        warbowPendingRevengeExpiry[msg.sender] = 0;

        emit WarBowRevenge(msg.sender, stealer, take, WARBOW_REVENGE_BURN_WAD);
    }

    /// @notice Burn **10 CL8Y**; for **6h** incoming steals use **1%** instead of **10%**.
    function warbowActivateGuard() external nonReentrant {
        require(saleStart > 0 && !ended, "TimeCurve: bad phase");
        acceptedAsset.safeTransferFrom(msg.sender, address(this), WARBOW_GUARD_BURN_WAD);
        emit WarBowCl8yBurned(msg.sender, uint8(WarBowBurnReason.Guard), WARBOW_GUARD_BURN_WAD);
        acceptedAsset.safeTransfer(BURN_SINK, WARBOW_GUARD_BURN_WAD);

        uint256 u = block.timestamp + WARBOW_GUARD_DURATION_SEC;
        if (u > warbowGuardUntil[msg.sender]) {
            warbowGuardUntil[msg.sender] = u;
        }
        emit WarBowGuardActivated(msg.sender, warbowGuardUntil[msg.sender], WARBOW_GUARD_BURN_WAD);
    }

    function _addBattlePoints(address a, uint256 v) internal {
        if (v == 0) return;
        battlePoints[a] += v;
        _updateWarbowPodium(a, battlePoints[a]);
    }

    function _subBattlePoints(address a, uint256 v) internal {
        if (v == 0) return;
        uint256 b = battlePoints[a];
        battlePoints[a] = b > v ? b - v : 0;
        _updateWarbowPodium(a, battlePoints[a]);
    }

    function _processDefendedStreak(address buyer, uint256 remainingBeforeBuy, uint256 actualSecondsAdded) internal {
        if (remainingBeforeBuy >= DEFENDED_STREAK_WINDOW_SEC) {
            if (_dsLastUnderWindowBuyer != address(0)) {
                activeDefendedStreak[_dsLastUnderWindowBuyer] = 0;
                emit WarBowDefendedStreakWindowCleared(_dsLastUnderWindowBuyer);
            }
            _dsLastUnderWindowBuyer = address(0);
            return;
        }

        if (_dsLastUnderWindowBuyer != address(0) && buyer != _dsLastUnderWindowBuyer) {
            uint256 brokenLen = activeDefendedStreak[_dsLastUnderWindowBuyer];
            activeDefendedStreak[_dsLastUnderWindowBuyer] = 0;
            if (brokenLen > 0) {
                emit WarBowDefendedStreakBroken(_dsLastUnderWindowBuyer, buyer, brokenLen);
            }
        }

        if (actualSecondsAdded > 0) {
            activeDefendedStreak[buyer] += 1;
            if (activeDefendedStreak[buyer] > bestDefendedStreak[buyer]) {
                bestDefendedStreak[buyer] = activeDefendedStreak[buyer];
            }
            _updateTopThreeMonotonic(CAT_DEFENDED_STREAK, buyer, bestDefendedStreak[buyer]);
            emit WarBowDefendedStreakContinued(buyer, activeDefendedStreak[buyer], bestDefendedStreak[buyer]);
        }

        _dsLastUnderWindowBuyer = buyer;
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

    /// @notice **40%** last buy · **25%** WarBow · **20%** defended streak · **15%** time booster
    ///         (integer split of podium pool; last slice takes remainder — matches 8/5/4/3% of gross raise vs 20% pool).
    function distributePrizes() external {
        require(ended, "TimeCurve: not ended");
        require(!prizesDistributed, "TimeCurve: prizes done");

        uint256 prizePool = acceptedAsset.balanceOf(address(podiumPool));
        if (prizePool == 0) {
            return;
        }

        uint256 sLast = (prizePool * 40) / 100;
        uint256 sWar = (prizePool * 25) / 100;
        uint256 sDef = (prizePool * 20) / 100;
        uint256 sTime = prizePool - sLast - sWar - sDef;

        prizesDistributed = true;

        _payPodiumFrom(_podiums[CAT_LAST_BUYERS], sLast, CAT_LAST_BUYERS);
        _payPodiumFrom(_warbowPodium, sWar, CAT_WARBOW);
        _payPodiumFrom(_podiums[CAT_DEFENDED_STREAK], sDef, CAT_DEFENDED_STREAK);
        _payPodiumFrom(_podiums[CAT_TIME_BOOSTER], sTime, CAT_TIME_BOOSTER);

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

    function _payPodiumFrom(Podium storage p, uint256 slice, uint8 category) internal {
        if (slice == 0) return;
        (uint256 sh0, uint256 sh1, uint256 sh2) = _podiumSharesFromSlice(slice);
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
        uint256 elapsed = saleStart > 0 ? block.timestamp - saleStart : 0;
        (uint256 minCharm,) = _charmBounds(elapsed);
        uint256 p = charmPrice.priceWad(elapsed);
        return Math.mulDiv(minCharm, p, WAD);
    }

    function currentMaxBuyAmount() external view returns (uint256) {
        uint256 elapsed = saleStart > 0 ? block.timestamp - saleStart : 0;
        (, uint256 maxCharm) = _charmBounds(elapsed);
        uint256 p = charmPrice.priceWad(elapsed);
        return Math.mulDiv(maxCharm, p, WAD);
    }

    function currentCharmBoundsWad() external view returns (uint256 minCharmWad, uint256 maxCharmWad) {
        uint256 elapsed = saleStart > 0 ? block.timestamp - saleStart : 0;
        return _charmBounds(elapsed);
    }

    function currentPricePerCharmWad() external view returns (uint256) {
        uint256 elapsed = saleStart > 0 ? block.timestamp - saleStart : 0;
        return charmPrice.priceWad(elapsed);
    }

    function podium(uint8 category) external view returns (address[3] memory winners, uint256[3] memory values) {
        require(category < NUM_PODIUM_CATEGORIES, "TimeCurve: bad category");
        Podium storage p = category == CAT_WARBOW ? _warbowPodium : _podiums[category];
        winners = p.winners;
        values = p.values;
    }

    /// @notice Top-3 **Battle Points** (same storage as `podium(CAT_WARBOW)`).
    function warbowLadderPodium() external view returns (address[3] memory winners, uint256[3] memory values) {
        winners = _warbowPodium.winners;
        values = _warbowPodium.values;
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

    function _updateTopThreeMonotonic(uint8 category, address candidate, uint256 candidateValue) internal {
        Podium storage p = _podiums[category];

        for (uint8 i; i < 3; ++i) {
            if (p.winners[i] == candidate) {
                p.values[i] = candidateValue;
                while (i > 0 && _betterRanked(p, i, i - 1)) {
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

    /// @dev Battle Points can decrease; maintain top-3 with deterministic tie-break (lower address ranks higher when tied).
    function _updateWarbowPodium(address candidate, uint256 candidateValue) internal {
        Podium storage p = _warbowPodium;
        bool found;
        for (uint8 i; i < 3; ++i) {
            if (p.winners[i] == candidate) {
                p.values[i] = candidateValue;
                found = true;
                break;
            }
        }
        if (!found && candidateValue > 0) {
            uint8 minIdx = 0;
            uint256 minVal = p.values[0];
            for (uint8 i = 1; i < 3; ++i) {
                if (p.values[i] < minVal || p.winners[i] == address(0)) {
                    minVal = p.values[i];
                    minIdx = i;
                }
            }
            if (p.winners[minIdx] == address(0) || candidateValue > minVal) {
                p.winners[minIdx] = candidate;
                p.values[minIdx] = candidateValue;
            }
        }
        _sortPodiumTriplet(p);
        for (uint8 i; i < 3; ++i) {
            if (p.values[i] == 0) {
                p.winners[i] = address(0);
            }
        }
    }

    function _sortPodiumTriplet(Podium storage p) internal {
        for (uint8 iter; iter < 3; ++iter) {
            bool swapped;
            for (uint8 i; i < 2; ++i) {
                if (_shouldSwapPodium(p, i, i + 1)) {
                    (p.winners[i], p.winners[i + 1]) = (p.winners[i + 1], p.winners[i]);
                    (p.values[i], p.values[i + 1]) = (p.values[i + 1], p.values[i]);
                    swapped = true;
                }
            }
            if (!swapped) break;
        }
    }

    function _shouldSwapPodium(Podium storage p, uint8 a, uint8 b) internal view returns (bool) {
        if (p.values[a] < p.values[b]) return true;
        if (p.values[a] > p.values[b]) return false;
        if (p.winners[a] == p.winners[b]) return false;
        return uint160(p.winners[a]) > uint160(p.winners[b]);
    }

    function _betterRanked(Podium storage p, uint8 a, uint8 b) internal view returns (bool) {
        if (p.values[a] > p.values[b]) return true;
        if (p.values[a] < p.values[b]) return false;
        return uint160(p.winners[a]) < uint160(p.winners[b]);
    }
}

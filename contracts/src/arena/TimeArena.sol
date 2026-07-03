// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TimeMath} from "../libraries/TimeMath.sol";
import {ArenaBuyRouting} from "./libraries/ArenaBuyRouting.sol";
import {ArenaPodiumSettlement} from "./libraries/ArenaPodiumSettlement.sol";
import {ArenaPodiumTimerConfig} from "./libraries/ArenaPodiumTimerConfig.sol";
import {ArenaCharmBounds} from "./libraries/ArenaCharmBounds.sol";
import {ArenaXp} from "./libraries/ArenaXp.sol";
import {AnvilKumbayaRouter} from "../fixtures/AnvilKumbayaFixture.sol";
import {AnvilKumbayaPools} from "../fixtures/AnvilKumbayaPools.sol";
import {ArenaCharmPriceTwap} from "../oracle/ArenaCharmPriceTwap.sol";
import {PodiumVaults} from "./PodiumVaults.sol";
import {IReferralRegistry} from "../interfaces/IReferralRegistry.sol";
import {IPlayCred} from "../interfaces/IPlayCred.sol";

/// @title TimeArena — persistent PvP timer arena (Arena v2)
contract TimeArena is Initializable, Ownable2StepUpgradeable, ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    uint8 public constant CAT_LAST_BUYERS = 0;
    uint8 public constant CAT_TIME_BOOSTER = 1;
    uint8 public constant CAT_DEFENDED_STREAK = 2;
    uint8 public constant CAT_WARBOW = 3;
    uint8 public constant NUM_PODIUM_CATEGORIES = 4;

    uint256 public constant DEFENDED_STREAK_WINDOW_SEC = 900;
    uint256 public constant CRED_PER_BUY = 35e18;
    /// @dev CRED burned per 1e18 CHARM on `buyWithCred` (GitLab #268).
    uint256 public constant CRED_PER_CHARM_WAD = 100e18;
    /// @dev One-time CRED credited to the next Last Buy epoch on a wallet's first buy (#268, #299).
    /// credBurn(ONBOARDING_STARTER_CHARM) × 110% — covers second `buyWithCred` at starter CHARM + headroom.
    uint256 public constant FIRST_BUY_CRED_BONUS = 1100e18;
    /// @dev Documented onboarding CHARM for progression math (#299).
    uint256 public constant ONBOARDING_STARTER_CHARM_WAD = 10e18;
    /// @dev Flat Play CRED minted to referrer and buyer per referred DOUB buy (GitLab #272).
    uint256 public constant REFERRAL_CRED_FLAT_WAD = 5e18;
    uint256 public constant SECONDS_PER_DAY = 86_400;
    /// @dev ln(1.1) in WAD — DOUB/CHARM grows ~10%/day within a Last Buy epoch (#305).
    uint256 public constant CHARM_GROWTH_RATE_WAD = TimeMath.CHARM_GROWTH_RATE_10PCT_WAD;

    uint256 public constant WARBOW_BASE_BUY_BP = 250;
    uint256 public constant WARBOW_TIMER_RESET_BONUS_BP = 500;
    uint256 public constant WARBOW_CLUTCH_BONUS_BP = 150;
    uint256 public constant WARBOW_STREAK_BREAK_MULT_BP = 100;
    uint256 public constant WARBOW_AMBUSH_BONUS_BP = 200;
    uint256 public constant WARBOW_FLAG_CLAIM_BP = 1000;
    uint256 public constant WARBOW_FLAG_SILENCE_SEC = 300;
    uint256 public constant WARBOW_STEAL_DOUB = 1000e18;
    uint256 public constant WARBOW_REVENGE_DOUB = 1000e18;
    uint256 public constant WARBOW_GUARD_DOUB = 10_000e18;
    uint256 public constant WARBOW_STEAL_LIMIT_BYPASS_DOUB = 50_000e18;
    uint256 public constant WARBOW_GUARD_DURATION_SEC = 6 hours;
    uint16 public constant WARBOW_STEAL_DRAIN_BPS = 1000;
    uint16 public constant WARBOW_STEAL_DRAIN_GUARDED_BPS = 100;
    uint8 public constant WARBOW_MAX_STEALS_PER_DAY = 3;
    uint256 public constant WARBOW_REVENGE_WINDOW_SEC = 24 hours;

    uint256 internal constant WAD = 1e18;

    IERC20 public doub;
    PodiumVaults public podiumVaults;
    /// @dev Reserved storage — former `AdminSellVault` slot (GitLab #314). Do not repurpose.
    address private __reservedAdminSellVault;
    IReferralRegistry public referralRegistry;
    IPlayCred public playCred;

    uint256 public charmPriceWad;
    /// @dev TWAP/spot anchor at current Last Buy epoch start; grows via `effectiveCharmPriceWad` (#305).
    uint256 public epochCharmAnchorWad;
    uint256 public epochAnchorTimestamp;
    /// @dev Anvil Kumbaya router for spot re-anchor; zero on production until configured.
    address public charmAnchorKumbayaRouter;
    address public charmAnchorCl8y;
    address public charmAnchorWeth;
    address public charmAnchorUsdm;
    /// @dev Cat-0 shims for ABI compat; authoritative values are per-category arrays (#271).
    uint256 public timerExtensionSec;
    uint256 public initialTimerSec;
    uint256 public timerCapSec;
    uint256[4] public podiumTimerExtensionSec;
    uint256[4] public podiumInitialTimerSec;
    uint256[4] public podiumTimerCapSec;
    uint256[4] public podiumResetBelowRemainingSec;
    uint256[4] public podiumResetToRemainingSec;
    /// @dev Legacy ABI mirror for the refill interval. New pacing uses buy-energy charges (#332).
    uint256 public buyCooldownSec;
    uint256 public buyChargeIntervalSec;
    uint8 public maxBuyCharges;
    uint256 public burstBuyCooldownSec;

    uint256 public arenaStart;
    uint256 public deadline;
    uint256 public lastBuyEpoch;
    uint256 public totalDoubRaised;
    uint256 public totalCharmWeight;
    bool public paused;

    uint256[4] public podiumDeadline;
    uint256[4] public podiumEpoch;
    /// @dev Per-category settlement timer armed on first qualifying buy in epoch ([#330](https://gitlab.com/PlasticDigits/yieldomega/-/issues/330)).
    bool[4] public podiumTimerArmed;

    mapping(address => uint256) public charmWeight;
    mapping(address => uint256) public buyCount;
    mapping(address => uint256) public totalEffectiveTimerSecAdded;
    mapping(address => uint256) public bestDefendedStreak;
    mapping(address => uint256) public activeDefendedStreak;
    mapping(address => uint256) public xp;
    mapping(address => uint256) internal _battlePoints;
    /// @dev Incremented on WarBow epoch roll; stale `_battlePoints` rows read as zero (#252).
    uint256 public warbowBpGeneration;
    mapping(address => uint256) public battlePointsGeneration;

    mapping(uint256 => mapping(address => uint256)) public epochCharmWad;
    mapping(uint256 => uint256) public epochCharmTotal;
    mapping(uint256 => uint256) public epochCredPool;
    /// @dev Fixed CRED claimable in `epoch` (first-buy bonus); append-only for UUPS (#268).
    mapping(uint256 => mapping(address => uint256)) public epochFixedCredBonus;

    mapping(address => uint256) public warbowGuardUntil;
    address public warbowPendingFlagOwner;
    uint256 public warbowPendingFlagPlantAt;
    mapping(address => mapping(uint256 => uint8)) public stealsReceivedOnDay;
    mapping(address => mapping(uint256 => uint8)) public stealsCommittedByAttackerOnDay;
    mapping(address => mapping(address => uint256)) public warbowPendingRevengeExpiryExclusive;
    mapping(address => mapping(address => uint256)) public warbowPendingRevengeStealSeq;
    mapping(uint256 => bool) public warbowEpochFinalized;

    address public timeArenaBuyRouter;

    struct Podium {
        address[3] winners;
        uint256[3] values;
    }

    Podium[4] internal _podiums;
    address[3] internal _lastBuyers;
    uint8 internal _lastBuyerIdx;
    uint256 internal _totalBuys;
    address internal _dsLastUnderWindowBuyer;

    /// @dev Cached progression (#265); 0 means level 1. Append-only for UUPS upgrades.
    mapping(address => uint256) internal _cachedLevel;
    mapping(address => uint256) public xpTowardNext;
    /// @dev Best three WarBow players not on the global podium; merged O(1) on BP changes (#312).
    Podium internal _warbowOffPodium;

    struct BuyEnergy {
        uint8 charges;
        uint40 lastRefillAt;
        uint40 lastBuyAt;
    }

    mapping(address => BuyEnergy) internal _buyEnergy;

    /// @dev Per-epoch Time Booster scores; stale rows read as zero (append-only UUPS).
    uint256 public timeBoosterGeneration;
    mapping(address => uint256) public timeBoosterScoreGeneration;
    mapping(address => uint256) public epochTimerSecAdded;

    /// @dev Per-epoch Defended Streak best; stale rows read as zero (append-only UUPS).
    uint256 public defendedStreakGeneration;
    mapping(address => uint256) public defendedStreakScoreGeneration;
    mapping(address => uint256) public epochBestDefendedStreak;

    event ArenaStarted(uint256 startTimestamp, uint256 initialDeadline);
    event LastBuyEpochStarted(uint256 indexed epoch, uint256 deadline);
    event LastBuyEpochCharmAnchored(
        uint256 indexed epoch, uint256 anchorWad, uint256 doubUsdWad, uint256 anchorTimestamp
    );
    event PodiumEpochRolled(
        uint8 indexed category,
        uint256 indexed epoch,
        address first,
        address second,
        address third,
        uint256 poolPaid
    );
    event Buy(
        address indexed buyer,
        uint256 charmWad,
        uint256 doubPaid,
        uint256 newDeadline,
        uint256 totalDoubRaisedAfter,
        uint256 buyIndex,
        uint256 actualSecondsAdded,
        bool timerHardReset,
        bool paidWithCred
    );
    event ReferralCredApplied(
        address indexed buyer,
        address indexed referrer,
        bytes32 indexed codeHash,
        uint256 referrerCred,
        uint256 buyerCred
    );
    event CredClaimed(address indexed user, uint256 indexed epoch, uint256 amount);
    event FirstBuyCredScheduled(address indexed buyer, uint256 indexed targetEpoch, uint256 amount);
    event XpGained(address indexed player, uint256 amount, uint256 newLevel);
    event LevelUp(address indexed player, uint256 newLevel);
    event FeatureUnlocked(address indexed player, uint256 featureLevel);
    event PausedSet(bool paused);
    event WarBowSteal(
        address indexed attacker,
        address indexed victim,
        uint256 bpTaken,
        uint256 doubSpent,
        bool limitBypassBurned
    );
    event WarBowRevenge(address indexed avenger, address indexed stealer, uint256 bpTaken, uint256 doubSpent);
    event WarBowGuard(address indexed player, uint256 doubSpent, uint256 guardUntil);
    event WarBowFlagClaimed(address indexed player, uint256 bonusBp);
    event WarbowPodiumFinalized(uint256 indexed epoch, address first, address second, address third);
    event PodiumPoolsToppedUp(address indexed donor, uint256 amountDoubWad);
    event PodiumTimerArmed(uint8 indexed category, uint256 indexed epoch);
    event PodiumTimerConfigUpdated(
        uint8 indexed category,
        uint256 extensionSec,
        uint256 initialTimerSec,
        uint256 timerCapSec,
        uint256 resetBelowRemainingSec,
        uint256 resetToRemainingSec
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _doub,
        PodiumVaults _podiumVaults,
        address _referralRegistry,
        address _playCred,
        uint256 _charmPriceWad,
        uint256[4] calldata _podiumTimerExtensionSec,
        uint256[4] calldata _podiumInitialTimerSec,
        uint256[4] calldata _podiumTimerCapSec,
        uint256[4] calldata _podiumResetBelowRemainingSec,
        uint256[4] calldata _podiumResetToRemainingSec,
        uint256 _buyChargeIntervalSec,
        uint8 _maxBuyCharges,
        uint256 _burstBuyCooldownSec,
        address upgradeAdmin
    ) external initializer {
        __Ownable_init(upgradeAdmin);
        __Ownable2Step_init();
        require(address(_doub) != address(0), "TimeArena: zero doub");
        require(address(_podiumVaults) != address(0), "TimeArena: zero vaults");
        require(_charmPriceWad > 0, "TimeArena: zero price");
        require(_buyChargeIntervalSec > 0, "TimeArena: zero charge interval");
        require(_maxBuyCharges > 0, "TimeArena: zero max charges");
        require(_burstBuyCooldownSec > 0, "TimeArena: zero burst cooldown");

        ArenaPodiumTimerConfig.validate(
            _podiumTimerExtensionSec,
            _podiumInitialTimerSec,
            _podiumTimerCapSec,
            _podiumResetBelowRemainingSec,
            _podiumResetToRemainingSec
        );

        doub = _doub;
        podiumVaults = _podiumVaults;
        if (_referralRegistry != address(0)) {
            referralRegistry = IReferralRegistry(_referralRegistry);
        }
        if (_playCred != address(0)) {
            playCred = IPlayCred(_playCred);
        }
        charmPriceWad = _charmPriceWad;
        epochCharmAnchorWad = _charmPriceWad;
        for (uint8 i; i < NUM_PODIUM_CATEGORIES; ++i) {
            podiumTimerExtensionSec[i] = _podiumTimerExtensionSec[i];
            podiumInitialTimerSec[i] = _podiumInitialTimerSec[i];
            podiumTimerCapSec[i] = _podiumTimerCapSec[i];
            podiumResetBelowRemainingSec[i] = _podiumResetBelowRemainingSec[i];
            podiumResetToRemainingSec[i] = _podiumResetToRemainingSec[i];
        }
        timerExtensionSec = _podiumTimerExtensionSec[CAT_LAST_BUYERS];
        initialTimerSec = _podiumInitialTimerSec[CAT_LAST_BUYERS];
        timerCapSec = _podiumTimerCapSec[CAT_LAST_BUYERS];
        buyCooldownSec = _buyChargeIntervalSec;
        buyChargeIntervalSec = _buyChargeIntervalSec;
        maxBuyCharges = _maxBuyCharges;
        burstBuyCooldownSec = _burstBuyCooldownSec;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function setCharmPriceWad(uint256 wad) external onlyOwner {
        require(arenaStart == 0, "TimeArena: use setEpochCharmAnchorWad");
        _setEpochCharmAnchor(wad);
    }

    /// @dev Owner break-glass: set epoch anchor and reset growth clock (#305).
    function setEpochCharmAnchorWad(uint256 wad) external onlyOwner {
        _setEpochCharmAnchor(wad);
        emit LastBuyEpochCharmAnchored(lastBuyEpoch, wad, 0, block.timestamp);
    }

    function setCharmAnchorOracle(address router, address cl8y, address weth, address usdm) external onlyOwner {
        charmAnchorKumbayaRouter = router;
        charmAnchorCl8y = cl8y;
        charmAnchorWeth = weth;
        charmAnchorUsdm = usdm;
    }

    function setTimeArenaBuyRouter(address router) external onlyOwner {
        timeArenaBuyRouter = router;
    }

    /// @dev Owner retune per-category prize-settlement timers (#271). Scoring hooks still use Last Buy only.
    function setPodiumTimerConfig(
        uint8 category,
        uint256 _extensionSec,
        uint256 _initialTimerSec,
        uint256 _timerCapSec,
        uint256 _resetBelowRemainingSec,
        uint256 _resetToRemainingSec
    ) external onlyOwner {
        require(category < NUM_PODIUM_CATEGORIES, "TimeArena: bad cat");
        ArenaPodiumTimerConfig.validateOne(
            _extensionSec, _initialTimerSec, _timerCapSec, _resetBelowRemainingSec, _resetToRemainingSec
        );

        podiumTimerExtensionSec[category] = _extensionSec;
        podiumInitialTimerSec[category] = _initialTimerSec;
        podiumTimerCapSec[category] = _timerCapSec;
        podiumResetBelowRemainingSec[category] = _resetBelowRemainingSec;
        podiumResetToRemainingSec[category] = _resetToRemainingSec;

        if (category == CAT_LAST_BUYERS) {
            timerExtensionSec = _extensionSec;
            initialTimerSec = _initialTimerSec;
            timerCapSec = _timerCapSec;
        }

        emit PodiumTimerConfigUpdated(
            category,
            _extensionSec,
            _initialTimerSec,
            _timerCapSec,
            _resetBelowRemainingSec,
            _resetToRemainingSec
        );
    }

    function startArena() external onlyOwner {
        require(arenaStart == 0, "TimeArena: started");
        arenaStart = block.timestamp;
        epochAnchorTimestamp = block.timestamp;
        for (uint8 i; i < NUM_PODIUM_CATEGORIES; ++i) {
            podiumTimerArmed[i] = false;
            podiumDeadline[i] = 0;
        }
        deadline = 0;
        emit ArenaStarted(arenaStart, deadline);
    }

    /// @dev Current DOUB wei per 1e18 CHARM for DOUB buys — epoch anchor + 10%/day growth (#305).
    function effectiveCharmPriceWad() public view returns (uint256) {
        uint256 anchor = epochCharmAnchorWad;
        if (anchor == 0) anchor = charmPriceWad;
        if (anchor == 0) return 0;
        if (epochAnchorTimestamp == 0 || block.timestamp <= epochAnchorTimestamp) {
            return anchor;
        }
        uint256 elapsed = block.timestamp - epochAnchorTimestamp;
        return TimeMath.growWad(anchor, CHARM_GROWTH_RATE_WAD, elapsed);
    }

    /// @notice Gross DOUB wei for `buy` / `buyFor` at the current block — `eth_call` / `staticcall` safe (#315).
    /// @dev When Last Buy is in the hard-reset band (`remaining < podiumResetBelowRemainingSec[0]`),
    ///      samples the same anchor as `_reanchorEpochCharmPrice` **before** the buy writes state:
    ///      Anvil spot via `setCharmAnchorOracle`, MegaETH **4326** Kumbaya V3 TWAP (`ArenaCharmPriceTwap`),
    ///      or falls back to stored `epochCharmAnchorWad` / `charmPriceWad`. Otherwise uses
    ///      `effectiveCharmPriceWad()` (epoch anchor + 10%/day growth). External pool/oracle reads
    ///      are view-only — no state writes on this path. Integrators: prefer this over
    ///      `effectiveCharmPriceWad` for swap sizing at the reset boundary. TWAP re-anchor is sampled
    ///      at tx time, so same-block sandwich cannot underpay vs the executed buy (#315).
    function doubOwedForBuy(uint256 charmWad) external view returns (uint256) {
        if (_willLastBuyHardReset()) {
            (uint256 anchorWad,) = _sampleCharmAnchor();
            return Math.mulDiv(charmWad, anchorWad, WAD);
        }
        return Math.mulDiv(charmWad, effectiveCharmPriceWad(), WAD);
    }

    function buy(uint256 charmWad) external nonReentrant {
        _buyDoub(msg.sender, charmWad, bytes32(0), false);
    }

    function buy(uint256 charmWad, bytes32 codeHash) external nonReentrant {
        _buyDoub(msg.sender, charmWad, codeHash, false);
    }

    function buyWithCred(uint256 charmWad) external nonReentrant {
        _buyCred(msg.sender, charmWad);
    }

    function buyFor(address buyer, uint256 charmWad, bytes32 codeHash, bool plantWarBowFlag)
        external
        nonReentrant
    {
        require(msg.sender == timeArenaBuyRouter, "TimeArena: not router");
        _buyDoub(buyer, charmWad, codeHash, plantWarBowFlag);
    }

    function nextBuyAllowedAt(address buyer) public view returns (uint256) {
        (,,,,, uint256 nextAllowedAt) = buyEnergyState(buyer);
        return nextAllowedAt;
    }

    function buyEnergyState(address buyer)
        public
        view
        returns (
            uint8 charges,
            uint8 maxCharges,
            uint256 lastRefillAt,
            uint256 lastBuyAt,
            uint256 nextChargeAt,
            uint256 nextAllowedAt
        )
    {
        BuyEnergy memory energy = _buyEnergy[buyer];
        maxCharges = _effectiveMaxBuyCharges(buyer);
        (charges, lastRefillAt) = _refilledBuyEnergy(energy, block.timestamp, maxCharges);
        lastBuyAt = energy.lastBuyAt;
        if (charges >= maxCharges) {
            nextChargeAt = 0;
        } else {
            nextChargeAt = lastRefillAt + buyChargeIntervalSec;
        }
        uint256 burstAllowedAt = lastBuyAt == 0 ? 0 : lastBuyAt + burstBuyCooldownSec;
        nextAllowedAt = burstAllowedAt;
        if (charges == 0 && nextChargeAt > nextAllowedAt) {
            nextAllowedAt = nextChargeAt;
        }
    }

    /// @notice Permissionless DOUB top-up across all eight prize vaults (no admin take; GitLab #261).
    function topUpPodiumPools(uint256 amountDoubWad) external nonReentrant {
        _requireLive();
        require(amountDoubWad > 0, "TimeArena: zero amount");
        uint256 received = _pullDoubExact(msg.sender, amountDoubWad);
        _routeDoubPrizeTopUp(received);
        emit PodiumPoolsToppedUp(msg.sender, received);
    }

    function claimCred(uint256 epoch) external nonReentrant {
        _requireLive();
        require(address(playCred) != address(0), "TimeArena: no cred");
        require(epoch < lastBuyEpoch, "TimeArena: epoch active");
        uint256 weight = epochCharmWad[epoch][msg.sender];
        uint256 bonus = epochFixedCredBonus[epoch][msg.sender];
        require(weight > 0 || bonus > 0, "TimeArena: nothing to claim");
        uint256 amount = bonus;
        uint256 total = epochCharmTotal[epoch];
        if (weight > 0 && total > 0) {
            amount += Math.mulDiv(epochCredPool[epoch], weight, total);
        }
        epochCharmWad[epoch][msg.sender] = 0;
        epochFixedCredBonus[epoch][msg.sender] = 0;
        playCred.mint(msg.sender, amount);
        emit CredClaimed(msg.sender, epoch, amount);
    }

    function rollPodiumEpoch(uint8 category) external nonReentrant {
        _requireLive();
        require(category < NUM_PODIUM_CATEGORIES, "TimeArena: bad cat");
        require(podiumTimerArmed[category], "TimeArena: timer not armed");
        require(block.timestamp > podiumDeadline[category], "TimeArena: timer live");
        _rollPodiumEpoch(category);
    }

    /// @dev Owner-trusted finalize superseded by on-chain autoroll payout (#312).
    function finalizeWarbowPodium(uint256, address, address, address) external pure {
        revert("TimeArena: superseded");
    }

    function _rollPodiumEpoch(uint8 category) internal {
        address[3] memory winners;
        uint256[3] memory values;
        if (category == CAT_LAST_BUYERS) {
            (winners, values) = _lastBuyPodium();
        } else {
            Podium storage p = _podiums[category];
            winners = p.winners;
            values = p.values;
        }

        uint256 epochBefore = podiumEpoch[category];
        uint256 poolBal = podiumVaults.activePoolBalance(category);
        if (poolBal > 0) {
            (uint256 a, uint256 b, uint256 c) = ArenaPodiumSettlement.payoutShares(poolBal);
            podiumVaults.payPodiumWinners(category, winners[0], winners[1], winners[2], a, b, c);
        }
        podiumVaults.rollEpochTranches(category);

        podiumEpoch[category] = epochBefore + 1;
        podiumTimerArmed[category] = false;
        podiumDeadline[category] = 0;
        if (category == CAT_LAST_BUYERS) {
            deadline = 0;
        }

        _clearPodium(category);

        if (category == CAT_TIME_BOOSTER) {
            timeBoosterGeneration += 1;
        } else if (category == CAT_DEFENDED_STREAK) {
            defendedStreakGeneration += 1;
        } else if (category == CAT_WARBOW) {
            warbowEpochFinalized[epochBefore] = true;
            emit WarbowPodiumFinalized(epochBefore, winners[0], winners[1], winners[2]);
            _clearAllBattlePoints();
        }

        emit PodiumEpochRolled(category, podiumEpoch[category], winners[0], winners[1], winners[2], poolBal);
    }

    function warbowSteal(address victim, bool payBypassBurn) external nonReentrant {
        _requireLiveAndAutoroll();
        _requireWarbowLevel(msg.sender);
        require(victim != address(0) && victim != msg.sender, "TimeArena: bad victim");
        uint256 day = block.timestamp / SECONDS_PER_DAY;
        uint8 victimSteals = stealsReceivedOnDay[victim][day];
        uint8 attackerSteals = stealsCommittedByAttackerOnDay[msg.sender][day];
        bool needBypass = victimSteals >= WARBOW_MAX_STEALS_PER_DAY || attackerSteals >= WARBOW_MAX_STEALS_PER_DAY;

        uint256 spent = _pullDoubExact(msg.sender, WARBOW_STEAL_DOUB);
        if (needBypass) {
            require(payBypassBurn, "TimeArena: steal limit");
            spent += _pullDoubExact(msg.sender, WARBOW_STEAL_LIMIT_BYPASS_DOUB);
        }
        _routeWarbowDoubSpend(spent);

        uint256 vbp = _effectiveBattlePoints(victim);
        uint256 abp = _effectiveBattlePoints(msg.sender);
        require(abp > 0 && vbp >= 2 * abp && vbp <= 10 * abp, "TimeArena: steal band");

        uint16 bps = block.timestamp < warbowGuardUntil[victim] ? WARBOW_STEAL_DRAIN_GUARDED_BPS : WARBOW_STEAL_DRAIN_BPS;
        uint256 take = Math.mulDiv(vbp, bps, 10_000);
        require(take > 0, "TimeArena: steal zero");
        _subBattlePoints(victim, take);
        _addBattlePoints(msg.sender, take);
        _updateWarbowRanking(victim, _effectiveBattlePoints(victim));
        _updateWarbowRanking(msg.sender, _effectiveBattlePoints(msg.sender));

        if (victimSteals < type(uint8).max) stealsReceivedOnDay[victim][day] = victimSteals + 1;
        if (attackerSteals < type(uint8).max) stealsCommittedByAttackerOnDay[msg.sender][day] = attackerSteals + 1;

        warbowPendingRevengeExpiryExclusive[victim][msg.sender] = block.timestamp + WARBOW_REVENGE_WINDOW_SEC;
        warbowPendingRevengeStealSeq[victim][msg.sender] += 1;

        emit WarBowSteal(msg.sender, victim, take, spent, needBypass);
    }

    function warbowRevenge(address stealer) external nonReentrant {
        _requireLiveAndAutoroll();
        _requireWarbowLevel(msg.sender);
        uint256 exp = warbowPendingRevengeExpiryExclusive[msg.sender][stealer];
        require(exp != 0 && block.timestamp < exp, "TimeArena: revenge");

        uint256 spent = _pullDoubExact(msg.sender, WARBOW_REVENGE_DOUB);
        _routeWarbowDoubSpend(spent);
        uint256 take = Math.mulDiv(_effectiveBattlePoints(stealer), WARBOW_STEAL_DRAIN_BPS, 10_000);
        require(take > 0, "TimeArena: revenge zero");
        _subBattlePoints(stealer, take);
        _addBattlePoints(msg.sender, take);
        _updateWarbowRanking(stealer, _effectiveBattlePoints(stealer));
        _updateWarbowRanking(msg.sender, _effectiveBattlePoints(msg.sender));
        warbowPendingRevengeExpiryExclusive[msg.sender][stealer] = 0;
        emit WarBowRevenge(msg.sender, stealer, take, spent);
    }

    function warbowActivateGuard() external nonReentrant {
        _requireLiveAndAutoroll();
        _requireWarbowLevel(msg.sender);
        uint256 spent = _pullDoubExact(msg.sender, WARBOW_GUARD_DOUB);
        _routeWarbowDoubSpend(spent);
        warbowGuardUntil[msg.sender] = block.timestamp + WARBOW_GUARD_DURATION_SEC;
        emit WarBowGuard(msg.sender, spent, warbowGuardUntil[msg.sender]);
    }

    function claimWarBowFlag() external nonReentrant {
        _requireLiveAndAutoroll();
        require(warbowPendingFlagOwner == msg.sender, "TimeArena: not flag holder");
        require(block.timestamp >= warbowPendingFlagPlantAt + WARBOW_FLAG_SILENCE_SEC, "TimeArena: flag silence");
        warbowPendingFlagOwner = address(0);
        warbowPendingFlagPlantAt = 0;
        _addBattlePoints(msg.sender, WARBOW_FLAG_CLAIM_BP);
        _updateWarbowRanking(msg.sender, _effectiveBattlePoints(msg.sender));
        emit WarBowFlagClaimed(msg.sender, WARBOW_FLAG_CLAIM_BP);
    }

    function level(address user) external view returns (uint256) {
        return _playerLevel(user);
    }

    /// @dev Highest feature tier unlocked by progression (#299); mirrors capped `level`.
    function unlockedLevel(address user) external view returns (uint256) {
        return _playerLevel(user);
    }

    function _playerLevel(address user) internal view returns (uint256) {
        uint256 cached = _cachedLevel[user];
        uint256 lvl = cached == 0 ? 1 : cached;
        return ArenaXp.clampLevel(lvl);
    }

    function xpToNextLevel(address user) external view returns (uint256) {
        uint256 cached = _cachedLevel[user];
        uint256 lvl = cached == 0 ? 1 : cached;
        return ArenaXp.xpRemainingToNextLevel(lvl, xpTowardNext[user]);
    }

    function pendingCred(address user, uint256 epoch) external view returns (uint256) {
        uint256 bonus = epochFixedCredBonus[epoch][user];
        uint256 weight = epochCharmWad[epoch][user];
        uint256 total = epochCharmTotal[epoch];
        uint256 proRata;
        if (weight > 0 && total > 0) {
            proRata = Math.mulDiv(epochCredPool[epoch], weight, total);
        }
        return proRata + bonus;
    }

    function podium(uint8 category) external view returns (address[3] memory winners, uint256[3] memory values) {
        require(category < NUM_PODIUM_CATEGORIES, "TimeArena: bad cat");
        if (category == CAT_LAST_BUYERS) {
            return _lastBuyPodium();
        }
        Podium storage p = _podiums[category];
        return (p.winners, p.values);
    }

    function lastBuyers() external view returns (address[3] memory) {
        return _lastBuyers;
    }

    function _buyDoub(address buyer, uint256 charmWad, bytes32 codeHash, bool plantWarBowFlag) internal {
        _requireLiveAndAutoroll();
        _validateCharm(charmWad);
        _spendBuyCharge(buyer);

        _prepareBuyBeforeTimer();

        uint256 doubOwed = Math.mulDiv(charmWad, effectiveCharmPriceWad(), WAD);
        // `buyFor` is router-only: DOUB was swapped onto `timeArenaBuyRouter`, not the participant wallet (#251 / #270).
        address doubPayer = msg.sender == timeArenaBuyRouter ? msg.sender : buyer;
        uint256 received = _pullDoubExact(doubPayer, doubOwed);

        _accrueCharmAndCred(buyer, charmWad, codeHash);
        _routeDoubPrizeSplit(received);
        totalDoubRaised += received;
        _finishBuy(buyer, charmWad, received, false, plantWarBowFlag);
    }

    function _buyCred(address buyer, uint256 charmWad) internal {
        _requireLiveAndAutoroll();
        _validateCharm(charmWad);
        _spendBuyCharge(buyer);
        _prepareBuyBeforeTimer();
        require(address(playCred) != address(0), "TimeArena: no cred");
        uint256 credBurn = Math.mulDiv(charmWad, CRED_PER_CHARM_WAD, WAD);
        require(credBurn > 0, "TimeArena: zero cred burn");
        playCred.burn(buyer, credBurn);
        _accrueCharmAndCred(buyer, charmWad, bytes32(0));
        _finishBuy(buyer, charmWad, 0, true, false);
    }

    function _finishBuy(address buyer, uint256 charmWad, uint256 received, bool paidWithCred, bool plantWarBowFlag)
        internal
    {
        bool isFirstBuy = buyCount[buyer] == 0;
        buyCount[buyer] += 1;
        _totalBuys += 1;

        _armPodiumTimer(CAT_LAST_BUYERS);
        uint256 deadlineBefore = deadline;
        uint256 remainingBefore = deadlineBefore > block.timestamp ? deadlineBefore - block.timestamp : 0;

        (uint256 newDl, bool hardReset) = TimeMath.extendDeadlineOrResetBelowThreshold(
            deadlineBefore,
            block.timestamp,
            podiumTimerExtensionSec[CAT_LAST_BUYERS],
            podiumTimerCapSec[CAT_LAST_BUYERS],
            podiumResetBelowRemainingSec[CAT_LAST_BUYERS],
            podiumResetToRemainingSec[CAT_LAST_BUYERS]
        );
        deadline = newDl;
        podiumDeadline[CAT_LAST_BUYERS] = newDl;
        if (hardReset) {
            emit LastBuyEpochStarted(lastBuyEpoch, newDl);
        }

        if (isFirstBuy && address(playCred) != address(0)) {
            uint256 targetEpoch = lastBuyEpoch + 1;
            epochFixedCredBonus[targetEpoch][buyer] += FIRST_BUY_CRED_BONUS;
            emit FirstBuyCredScheduled(buyer, targetEpoch, FIRST_BUY_CRED_BONUS);
        }

        uint256 actualSecondsAdded = deadline > deadlineBefore ? deadline - deadlineBefore : 0;

        uint256 lvlBefore = _cachedLevel[buyer];
        if (lvlBefore == 0) lvlBefore = 1;
        uint256 xpGain = ArenaXp.xpForCharm(charmWad);
        xp[buyer] += xpGain;
        uint256 toward = xpTowardNext[buyer];
        uint256 lvlAfter;
        (lvlAfter, toward) = ArenaXp.applyXpGain(lvlBefore, toward, xpGain);
        _cachedLevel[buyer] = lvlAfter;
        xpTowardNext[buyer] = toward;
        emit XpGained(buyer, xpGain, lvlAfter);
        if (lvlAfter > lvlBefore) {
            emit LevelUp(buyer, lvlAfter);
            for (uint256 f = lvlBefore + 1; f <= lvlAfter; ++f) {
                emit FeatureUnlocked(buyer, f);
            }
        }

        uint256 gateLevel = lvlAfter;

        _trackLastBuyer(buyer);

        if (gateLevel >= 2) {
            _extendPodiumTimer(CAT_TIME_BOOSTER);
            if (actualSecondsAdded > 0) {
                totalEffectiveTimerSecAdded[buyer] += actualSecondsAdded;
                uint256 epochTimer = _addEpochTimerSec(buyer, actualSecondsAdded);
                _updateTopThree(CAT_TIME_BOOSTER, buyer, epochTimer);
            }
        }
        address prevDsBuyer = _dsLastUnderWindowBuyer;
        uint256 prevDsStreak = prevDsBuyer != address(0) ? activeDefendedStreak[prevDsBuyer] : 0;
        if (gateLevel >= 3) {
            _extendPodiumTimer(CAT_DEFENDED_STREAK);
            _processDefendedStreak(buyer, remainingBefore, actualSecondsAdded);
        }
        if (gateLevel >= 4) {
            _extendPodiumTimer(CAT_WARBOW);
            _applyBuyWarBowBp(buyer, remainingBefore, hardReset, prevDsBuyer, prevDsStreak);
        }
        if (gateLevel >= 5) {
            _applyWarBowFlagOnBuy(buyer, plantWarBowFlag);
        }

        emit Buy(
            buyer,
            charmWad,
            received,
            deadline,
            totalDoubRaised,
            _totalBuys,
            actualSecondsAdded,
            hardReset,
            paidWithCred
        );
    }

    function _armPodiumTimer(uint8 category) internal {
        if (podiumTimerArmed[category]) return;
        podiumTimerArmed[category] = true;
        uint256 dl = block.timestamp + podiumInitialTimerSec[category];
        podiumDeadline[category] = dl;
        if (category == CAT_LAST_BUYERS) {
            deadline = dl;
        }
        emit PodiumTimerArmed(category, podiumEpoch[category]);
    }

    function _spendBuyCharge(address buyer) internal {
        BuyEnergy storage energy = _buyEnergy[buyer];
        uint8 cap = _effectiveMaxBuyCharges(buyer);
        (uint8 charges, uint256 refillAt) = _refilledBuyEnergy(energy, block.timestamp, cap);
        require(charges > 0, "TimeArena: no buy charges");
        uint256 lastBuyAt = energy.lastBuyAt;
        require(lastBuyAt == 0 || block.timestamp >= lastBuyAt + burstBuyCooldownSec, "TimeArena: burst cooldown");

        unchecked {
            charges -= 1;
        }
        energy.charges = charges;
        energy.lastRefillAt = uint40(refillAt);
        energy.lastBuyAt = uint40(block.timestamp);
    }

    function _effectiveMaxBuyCharges(address buyer) internal view returns (uint8) {
        uint256 lvl = _playerLevel(buyer);
        uint256 cap = uint256(maxBuyCharges) + lvl - 1;
        return cap > type(uint8).max ? type(uint8).max : uint8(cap);
    }

    function _refilledBuyEnergy(BuyEnergy memory energy, uint256 nowSec, uint8 cap)
        internal
        view
        returns (uint8 charges, uint256 lastRefillAt)
    {
        if (energy.lastRefillAt == 0) {
            return (cap, nowSec);
        }

        charges = energy.charges;
        lastRefillAt = energy.lastRefillAt;
        if (charges >= cap) {
            return (cap, nowSec);
        }

        uint256 elapsed = nowSec > lastRefillAt ? nowSec - lastRefillAt : 0;
        uint256 earned = elapsed / buyChargeIntervalSec;
        if (earned == 0) {
            return (charges, lastRefillAt);
        }

        uint256 nextCharges = uint256(charges) + earned;
        if (nextCharges >= cap) {
            return (cap, nowSec);
        }
        return (uint8(nextCharges), lastRefillAt + earned * buyChargeIntervalSec);
    }

    function _extendPodiumTimer(uint8 category) internal {
        _armPodiumTimer(category);
        (uint256 nd,) = TimeMath.extendDeadlineOrResetBelowThreshold(
            podiumDeadline[category],
            block.timestamp,
            podiumTimerExtensionSec[category],
            podiumTimerCapSec[category],
            podiumResetBelowRemainingSec[category],
            podiumResetToRemainingSec[category]
        );
        podiumDeadline[category] = nd;
    }

    function _applyWarBowFlagOnBuy(address buyer, bool plant) internal {
        if (plant) {
            warbowPendingFlagOwner = buyer;
            warbowPendingFlagPlantAt = block.timestamp;
            return;
        }
        if (warbowPendingFlagOwner != address(0) && warbowPendingFlagOwner != buyer) {
            warbowPendingFlagOwner = address(0);
            warbowPendingFlagPlantAt = 0;
        }
    }

    function _requireWarbowLevel(address player) internal view {
        require(_playerLevel(player) >= 4, "TimeArena: level");
    }

    /// @dev One-shot migration (#299): full unlock for wallets that bought before progression shipped.
    function grandfatherProgression(address[] calldata wallets) external onlyOwner {
        for (uint256 i; i < wallets.length; ++i) {
            address w = wallets[i];
            if (buyCount[w] > 0) {
                _cachedLevel[w] = ArenaXp.MAX_PLAYER_LEVEL;
            }
        }
    }

    function _accrueCharmAndCred(address buyer, uint256 charmWad, bytes32 codeHash) internal {
        uint256 ep = lastBuyEpoch;
        epochCharmWad[ep][buyer] += charmWad;
        epochCharmTotal[ep] += charmWad;
        epochCredPool[ep] += CRED_PER_BUY;
        charmWeight[buyer] += charmWad;
        totalCharmWeight += charmWad;

        if (codeHash != bytes32(0) && address(referralRegistry) != address(0)) {
            address referrer = referralRegistry.ownerOfCode(codeHash);
            require(referrer != address(0), "TimeArena: invalid referral");
            require(referrer != buyer, "TimeArena: self-referral");
            if (address(playCred) != address(0)) {
                uint256 each = REFERRAL_CRED_FLAT_WAD;
                playCred.mint(referrer, each);
                playCred.mint(buyer, each);
                emit ReferralCredApplied(buyer, referrer, codeHash, each, each);
            }
        }
    }

    function _applyBuyWarBowBp(
        address buyer,
        uint256 remainingBefore,
        bool hardReset,
        address prevDsBuyer,
        uint256 prevDsStreak
    ) internal {
        uint256 bp = WARBOW_BASE_BUY_BP;
        if (hardReset) bp += WARBOW_TIMER_RESET_BONUS_BP;
        if (remainingBefore < 30) bp += WARBOW_CLUTCH_BONUS_BP;
        if (
            remainingBefore < DEFENDED_STREAK_WINDOW_SEC && prevDsBuyer != address(0) && prevDsBuyer != buyer
                && prevDsStreak > 0
        ) {
            bp += prevDsStreak * WARBOW_STREAK_BREAK_MULT_BP;
            if (hardReset) bp += WARBOW_AMBUSH_BONUS_BP;
        }
        _addBattlePoints(buyer, bp);
        _updateWarbowRanking(buyer, _effectiveBattlePoints(buyer));
    }

    function _routeWarbowDoubSpend(uint256 amount) private {
        _routeDoubPrizeSplit(amount);
        totalDoubRaised += amount;
    }

    function battlePoints(address user) external view returns (uint256) {
        return _effectiveBattlePoints(user);
    }

    function effectiveEpochTimerSecAdded(address user) external view returns (uint256) {
        return _effectiveEpochTimerSecAdded(user);
    }

    function effectiveEpochBestDefendedStreak(address user) external view returns (uint256) {
        return _effectiveEpochBestDefendedStreak(user);
    }

    /// @dev One-shot UUPS migration: seed current Time Booster / Defended Streak slot scores for the in-flight epoch.
    function migrateEpochPodiumScores() external reinitializer(2) {
        _seedEpochPodiumScores(CAT_TIME_BOOSTER);
        _seedEpochPodiumScores(CAT_DEFENDED_STREAK);
    }

    /// @dev Default PodiumVaults maps every pool slot to `address(podiumVaults)` — one ERC-20 xfer
    /// instead of twelve per buy (#316). Per-tranche events unchanged; economics unchanged (#300).
    function _routeDoubPrizeSplit(uint256 amount) private returns (uint256 routed) {
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) = ArenaBuyRouting.splitBuyAmount(amount);
        address vaultAddr = address(podiumVaults);
        bool batchToVault = amount > 0;
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS && batchToVault; ++i) {
            if (
                podiumVaults.activePools(i) != vaultAddr || podiumVaults.seedPools(i) != vaultAddr
                    || podiumVaults.futurePools(i) != vaultAddr
            ) {
                batchToVault = false;
            }
        }
        if (batchToVault) {
            doub.safeTransfer(vaultAddr, amount);
            routed = amount;
        }
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            uint256 ep = podiumEpoch[i];
            if (cur[i] > 0) {
                address pool = podiumVaults.activePools(i);
                if (!batchToVault) {
                    doub.safeTransfer(pool, cur[i]);
                    routed += cur[i];
                }
                podiumVaults.creditTranche(i, 0, cur[i]);
                podiumVaults.notifyPodiumEpochFunded(i, ep, cur[i], pool);
            }
            if (nxt[i] > 0) {
                address pool = podiumVaults.seedPools(i);
                if (!batchToVault) {
                    doub.safeTransfer(pool, nxt[i]);
                    routed += nxt[i];
                }
                podiumVaults.creditTranche(i, 1, nxt[i]);
                podiumVaults.notifyPodiumEpochFunded(i, ep + 1, nxt[i], pool);
            }
            if (nxt2[i] > 0) {
                address pool = podiumVaults.futurePools(i);
                if (!batchToVault) {
                    doub.safeTransfer(pool, nxt2[i]);
                    routed += nxt2[i];
                }
                podiumVaults.creditTranche(i, 2, nxt2[i]);
                podiumVaults.notifyPodiumEpochFunded(i, ep + 2, nxt2[i], pool);
            }
        }
    }

    function _routeDoubPrizeTopUp(uint256 amount) private returns (uint256 routed) {
        (uint256[4] memory act, uint256[4] memory sed) = ArenaBuyRouting.splitPrizeTopUpAmount(amount);
        routed = _routeActiveAndSeedVaults(act, sed);
    }

    function _routeActiveAndSeedVaults(uint256[4] memory act, uint256[4] memory sed)
        private
        returns (uint256 routed)
    {
        address vaultAddr = address(podiumVaults);
        uint256 batchAmount;
        bool batchToVault = true;
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            batchAmount += act[i] + sed[i];
            if (podiumVaults.activePools(i) != vaultAddr || podiumVaults.seedPools(i) != vaultAddr) {
                batchToVault = false;
            }
        }
        if (batchToVault && batchAmount > 0) {
            doub.safeTransfer(vaultAddr, batchAmount);
            routed = batchAmount;
        }
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            if (act[i] > 0) {
                address pool = podiumVaults.activePools(i);
                if (!batchToVault) {
                    doub.safeTransfer(pool, act[i]);
                    routed += act[i];
                }
                podiumVaults.creditTranche(i, 0, act[i]);
                podiumVaults.notifyPodiumFunded(i, act[i], pool);
            }
            if (sed[i] > 0) {
                address pool = podiumVaults.seedPools(i);
                if (!batchToVault) {
                    doub.safeTransfer(pool, sed[i]);
                    routed += sed[i];
                }
                podiumVaults.creditTranche(i, 1, sed[i]);
                podiumVaults.notifySeedFunded(i, sed[i], pool);
            }
        }
    }

    function _pullDoubExact(address from, uint256 expected) private returns (uint256 received) {
        uint256 balBefore = doub.balanceOf(address(this));
        doub.safeTransferFrom(from, address(this), expected);
        received = doub.balanceOf(address(this)) - balBefore;
        require(received == expected, "TimeArena: ERC20 parity");
    }

    function _willLastBuyHardReset() internal view returns (bool) {
        if (arenaStart == 0 || !podiumTimerArmed[CAT_LAST_BUYERS]) return false;
        uint256 remaining = deadline > block.timestamp ? deadline - block.timestamp : 0;
        return remaining < podiumResetBelowRemainingSec[CAT_LAST_BUYERS];
    }

    function _prepareBuyBeforeTimer() internal {
        if (!_willLastBuyHardReset()) return;
        _reanchorEpochCharmPrice();
    }

    function _reanchorEpochCharmPrice() internal {
        (uint256 anchorWad, uint256 doubUsdWad) = _sampleCharmAnchor();
        lastBuyEpoch += 1;
        _setEpochCharmAnchor(anchorWad);
        emit LastBuyEpochCharmAnchored(lastBuyEpoch, anchorWad, doubUsdWad, block.timestamp);
    }

    function _setEpochCharmAnchor(uint256 wad) internal {
        require(wad > 0, "TimeArena: zero price");
        epochCharmAnchorWad = wad;
        epochAnchorTimestamp = block.timestamp;
        charmPriceWad = wad;
    }

    /// @dev Read-only anchor sample for hard-reset re-anchor and `doubOwedForBuy` preview (#315).
    function _sampleCharmAnchor() internal view returns (uint256 anchorWad, uint256 doubUsdWad) {
        if (charmAnchorKumbayaRouter != address(0) && charmAnchorCl8y != address(0)) {
            return AnvilKumbayaPools.charmPriceWadFromSpot(
                AnvilKumbayaRouter(charmAnchorKumbayaRouter),
                address(doub),
                charmAnchorCl8y,
                charmAnchorWeth,
                charmAnchorUsdm
            );
        }
        if (block.chainid == 4326) {
            ArenaCharmPriceTwap.Result memory r = ArenaCharmPriceTwap.compute(ArenaCharmPriceTwap.megaethMainnetConfig());
            return (r.charmPriceWad, r.doubUsdWad);
        }
        anchorWad = epochCharmAnchorWad != 0 ? epochCharmAnchorWad : charmPriceWad;
        doubUsdWad = 0;
    }

    function _requireLive() internal view {
        require(arenaStart > 0, "TimeArena: not started");
        require(!paused, "TimeArena: paused");
    }

    /// @dev Always-live: roll any expired podium timers before buys/WarBow (#312).
    function _requireLiveAndAutoroll() internal {
        _requireLive();
        _autorollExpiredPodiums();
    }

    function _autorollExpiredPodiums() internal {
        for (uint8 cat = 0; cat < NUM_PODIUM_CATEGORIES; ++cat) {
            if (podiumTimerArmed[cat] && block.timestamp > podiumDeadline[cat]) {
                _rollPodiumEpoch(cat);
            }
        }
    }

    function _validateCharm(uint256 charmWad) internal pure {
        ArenaCharmBounds.validate(charmWad);
    }

    function _trackLastBuyer(address buyer) private {
        _lastBuyerIdx = uint8((_lastBuyerIdx + 1) % 3);
        _lastBuyers[_lastBuyerIdx] = buyer;
        _updateTopThree(CAT_LAST_BUYERS, buyer, buyCount[buyer]);
    }

    function _lastBuyPodium() internal view returns (address[3] memory winners, uint256[3] memory values) {
        winners[0] = _lastBuyers[_lastBuyerIdx];
        winners[1] = _lastBuyers[uint8((_lastBuyerIdx + 2) % 3)];
        winners[2] = _lastBuyers[uint8((_lastBuyerIdx + 1) % 3)];
        values[0] = 3;
        values[1] = 2;
        values[2] = 1;
    }

    function _processDefendedStreak(address buyer, uint256 remainingBefore, uint256 secondsAdded) private {
        if (remainingBefore < DEFENDED_STREAK_WINDOW_SEC && secondsAdded > 0) {
            if (_dsLastUnderWindowBuyer == buyer) {
                activeDefendedStreak[buyer] += 1;
            } else {
                activeDefendedStreak[buyer] = 1;
                _dsLastUnderWindowBuyer = buyer;
            }
            if (activeDefendedStreak[buyer] > bestDefendedStreak[buyer]) {
                bestDefendedStreak[buyer] = activeDefendedStreak[buyer];
            }
            _maybeBumpEpochDefendedStreak(buyer);
            _updateTopThree(CAT_DEFENDED_STREAK, buyer, _effectiveEpochBestDefendedStreak(buyer));
        } else if (remainingBefore >= DEFENDED_STREAK_WINDOW_SEC) {
            if (_dsLastUnderWindowBuyer != address(0)) {
                activeDefendedStreak[_dsLastUnderWindowBuyer] = 0;
                _dsLastUnderWindowBuyer = address(0);
            }
            activeDefendedStreak[buyer] = 0;
        }
    }

    function _updateWarbowRanking(address entrant, uint256 value) private {
        if (value == 0) {
            _removeWarbowCandidate(entrant);
        } else {
            Podium storage g = _podiums[CAT_WARBOW];
            uint8 onSlot = 3;
            for (uint8 r; r < 3; ++r) {
                if (g.winners[r] == entrant) {
                    onSlot = r;
                    break;
                }
            }
            if (onSlot < 3) {
                g.values[onSlot] = value;
                _sortPodium(CAT_WARBOW);
            } else {
                _updateOffWarbowPodium(entrant, value);
            }
        }
        _mergeWarbowGlobalPodium();
    }

    function _removeWarbowCandidate(address entrant) private {
        Podium storage g = _podiums[CAT_WARBOW];
        for (uint8 r; r < 3; ++r) {
            if (g.winners[r] == entrant) {
                g.winners[r] = address(0);
                g.values[r] = 0;
                _sortPodium(CAT_WARBOW);
                return;
            }
        }
        Podium storage o = _warbowOffPodium;
        for (uint8 r; r < 3; ++r) {
            if (o.winners[r] == entrant) {
                o.winners[r] = address(0);
                o.values[r] = 0;
                _sortOffWarbowPodium();
                return;
            }
        }
    }

    function _updateOffWarbowPodium(address entrant, uint256 value) private {
        Podium storage o = _warbowOffPodium;
        for (uint8 r; r < 3; ++r) {
            if (o.winners[r] == entrant) {
                o.values[r] = value;
                _sortOffWarbowPodium();
                return;
            }
        }
        for (uint8 r; r < 3; ++r) {
            bool beats = value > o.values[r];
            bool tieLowerAddr = value == o.values[r] && uint160(entrant) < uint160(o.winners[r]);
            if (o.winners[r] == address(0) || beats || tieLowerAddr) {
                o.winners[r] = entrant;
                o.values[r] = value;
                _sortOffWarbowPodium();
                return;
            }
        }
    }

    function _sortOffWarbowPodium() private {
        _sortPodiumStorage(_warbowOffPodium);
    }

    /// @dev Merge global + off-podium candidates (≤6) into authoritative WarBow top-3.
    function _mergeWarbowGlobalPodium() private {
        Podium storage g = _podiums[CAT_WARBOW];
        Podium storage o = _warbowOffPodium;

        address[6] memory addrs;
        uint256[6] memory vals;
        uint8 n;
        for (uint8 i; i < 3; ++i) {
            if (g.winners[i] != address(0)) {
                addrs[n] = g.winners[i];
                vals[n] = g.values[i];
                unchecked {
                    ++n;
                }
            }
            if (o.winners[i] != address(0)) {
                address a = o.winners[i];
                uint256 v = o.values[i];
                bool dup;
                for (uint8 j; j < n; ++j) {
                    if (addrs[j] == a) {
                        if (v > vals[j]) vals[j] = v;
                        dup = true;
                        break;
                    }
                }
                if (!dup) {
                    addrs[n] = a;
                    vals[n] = v;
                    unchecked {
                        ++n;
                    }
                }
            }
        }

        for (uint8 i; i < n; ++i) {
            for (uint8 j = i + 1; j < n; ++j) {
                bool higher = vals[j] > vals[i];
                bool tieLowerAddr = vals[j] == vals[i] && uint160(addrs[j]) < uint160(addrs[i]);
                if (higher || tieLowerAddr) {
                    (addrs[i], addrs[j]) = (addrs[j], addrs[i]);
                    (vals[i], vals[j]) = (vals[j], vals[i]);
                }
            }
        }

        for (uint8 r; r < 3; ++r) {
            if (r < n) {
                g.winners[r] = addrs[r];
                g.values[r] = vals[r];
            } else {
                g.winners[r] = address(0);
                g.values[r] = 0;
            }
        }

        for (uint8 r; r < 3; ++r) {
            o.winners[r] = address(0);
            o.values[r] = 0;
        }
        for (uint8 i = 3; i < n; ++i) {
            uint8 offIdx = i - 3;
            o.winners[offIdx] = addrs[i];
            o.values[offIdx] = vals[i];
        }
        _sortOffWarbowPodium();
    }

    function _updateTopThree(uint8 cat, address entrant, uint256 value) private {
        Podium storage p = _podiums[cat];
        for (uint8 r; r < 3; ++r) {
            if (p.winners[r] == entrant) {
                p.values[r] = value;
                _sortPodium(cat);
                return;
            }
        }
        for (uint8 r; r < 3; ++r) {
            if (p.winners[r] == address(0) || value > p.values[r]) {
                address displaced = p.winners[r];
                p.winners[r] = entrant;
                p.values[r] = value;
                _sortPodium(cat);
                if (displaced != address(0) && displaced != entrant) {
                    uint256 displacedVal = _podiumMetric(cat, displaced);
                    if (displacedVal > 0) _updateTopThree(cat, displaced, displacedVal);
                }
                return;
            }
        }
    }

    function _podiumMetric(uint8 cat, address entrant) private view returns (uint256) {
        if (cat == CAT_WARBOW) return _effectiveBattlePoints(entrant);
        if (cat == CAT_TIME_BOOSTER) return _effectiveEpochTimerSecAdded(entrant);
        if (cat == CAT_DEFENDED_STREAK) return _effectiveEpochBestDefendedStreak(entrant);
        if (cat == CAT_LAST_BUYERS) return buyCount[entrant];
        return 0;
    }

    function _effectiveEpochTimerSecAdded(address user) private view returns (uint256) {
        if (timeBoosterScoreGeneration[user] != timeBoosterGeneration) return 0;
        return epochTimerSecAdded[user];
    }

    function _effectiveEpochBestDefendedStreak(address user) private view returns (uint256) {
        if (defendedStreakScoreGeneration[user] != defendedStreakGeneration) return 0;
        return epochBestDefendedStreak[user];
    }

    function _addEpochTimerSec(address buyer, uint256 sec) private returns (uint256) {
        if (timeBoosterScoreGeneration[buyer] != timeBoosterGeneration) {
            epochTimerSecAdded[buyer] = 0;
            timeBoosterScoreGeneration[buyer] = timeBoosterGeneration;
        }
        epochTimerSecAdded[buyer] += sec;
        return epochTimerSecAdded[buyer];
    }

    function _maybeBumpEpochDefendedStreak(address buyer) private {
        if (defendedStreakScoreGeneration[buyer] != defendedStreakGeneration) {
            epochBestDefendedStreak[buyer] = 0;
            defendedStreakScoreGeneration[buyer] = defendedStreakGeneration;
        }
        if (activeDefendedStreak[buyer] > epochBestDefendedStreak[buyer]) {
            epochBestDefendedStreak[buyer] = activeDefendedStreak[buyer];
        }
    }

    function _seedEpochPodiumScores(uint8 cat) private {
        Podium storage p = _podiums[cat];
        for (uint8 r; r < 3; ++r) {
            address w = p.winners[r];
            if (w == address(0)) continue;
            uint256 v = p.values[r];
            if (cat == CAT_TIME_BOOSTER) {
                epochTimerSecAdded[w] = v;
                timeBoosterScoreGeneration[w] = timeBoosterGeneration;
            } else if (cat == CAT_DEFENDED_STREAK) {
                epochBestDefendedStreak[w] = v;
                defendedStreakScoreGeneration[w] = defendedStreakGeneration;
            }
        }
    }

    function _sortPodium(uint8 cat) private {
        _sortPodiumStorage(_podiums[cat]);
    }

    function _sortPodiumStorage(Podium storage p) private {
        // Bubble-sort on three slots is O(1) and cheaper than heap setup (#316).
        for (uint8 i; i < 2; ++i) {
            for (uint8 j = i + 1; j < 3; ++j) {
                bool higher = p.values[j] > p.values[i];
                bool tieLowerAddr = p.values[j] == p.values[i] && uint160(p.winners[j]) < uint160(p.winners[i]);
                if (higher || tieLowerAddr) {
                    (p.winners[i], p.winners[j]) = (p.winners[j], p.winners[i]);
                    (p.values[i], p.values[j]) = (p.values[j], p.values[i]);
                }
            }
        }
    }

    function _clearPodium(uint8 cat) private {
        Podium storage p = _podiums[cat];
        for (uint8 r; r < 3; ++r) {
            p.winners[r] = address(0);
            p.values[r] = 0;
        }
        if (cat == CAT_LAST_BUYERS) {
            _lastBuyers = [address(0), address(0), address(0)];
            _lastBuyerIdx = 0;
        }
        if (cat == CAT_DEFENDED_STREAK) {
            _dsLastUnderWindowBuyer = address(0);
        }
    }

    function _clearAllBattlePoints() private {
        warbowBpGeneration += 1;
        _clearPodium(CAT_WARBOW);
        _clearOffWarbowPodium();
    }

    function _clearOffWarbowPodium() private {
        Podium storage o = _warbowOffPodium;
        for (uint8 r; r < 3; ++r) {
            o.winners[r] = address(0);
            o.values[r] = 0;
        }
    }

    function _effectiveBattlePoints(address user) private view returns (uint256) {
        if (battlePointsGeneration[user] != warbowBpGeneration) return 0;
        return _battlePoints[user];
    }

    function _addBattlePoints(address user, uint256 amt) private {
        if (battlePointsGeneration[user] != warbowBpGeneration) {
            _battlePoints[user] = 0;
            battlePointsGeneration[user] = warbowBpGeneration;
        }
        _battlePoints[user] += amt;
    }

    function _subBattlePoints(address user, uint256 amt) private {
        if (battlePointsGeneration[user] != warbowBpGeneration) return;
        if (amt >= _battlePoints[user]) {
            _battlePoints[user] = 0;
        } else {
            _battlePoints[user] -= amt;
        }
    }
}

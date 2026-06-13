// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TimeMath} from "../libraries/TimeMath.sol";
import {ArenaBuyRouting} from "./libraries/ArenaBuyRouting.sol";
import {ArenaPodiumSettlement} from "./libraries/ArenaPodiumSettlement.sol";
import {ArenaPodiumTimerConfig} from "./libraries/ArenaPodiumTimerConfig.sol";
import {ArenaXp} from "./libraries/ArenaXp.sol";
import {AnvilKumbayaRouter} from "../fixtures/AnvilKumbayaFixture.sol";
import {AnvilKumbayaPools} from "../fixtures/AnvilKumbayaPools.sol";
import {ArenaCharmPriceTwap} from "../oracle/ArenaCharmPriceTwap.sol";
import {PodiumVaults} from "./PodiumVaults.sol";
import {AdminSellVault} from "./AdminSellVault.sol";
import {IReferralRegistry} from "../interfaces/IReferralRegistry.sol";
import {IPlayCred} from "../interfaces/IPlayCred.sol";

/// @title TimeArena — persistent PvP timer arena (Arena v2)
contract TimeArena is Initializable, OwnableUpgradeable, ReentrancyGuard, UUPSUpgradeable {
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
    uint256 internal constant CHARM_MIN_WAD = 99e16;
    uint256 internal constant CHARM_MAX_WAD = 10e18;

    IERC20 public doub;
    PodiumVaults public podiumVaults;
    AdminSellVault public adminSellVault;
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
    uint256 public buyCooldownSec;

    uint256 public arenaStart;
    uint256 public deadline;
    uint256 public lastBuyEpoch;
    uint256 public totalDoubRaised;
    uint256 public totalCharmWeight;
    bool public paused;

    uint256[4] public podiumDeadline;
    uint256[4] public podiumEpoch;

    mapping(address => uint256) public charmWeight;
    mapping(address => uint256) public buyCount;
    mapping(address => uint256) public nextBuyAllowedAt;
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _doub,
        PodiumVaults _podiumVaults,
        AdminSellVault _adminSellVault,
        address _referralRegistry,
        address _playCred,
        uint256 _charmPriceWad,
        uint256[4] calldata _podiumTimerExtensionSec,
        uint256[4] calldata _podiumInitialTimerSec,
        uint256[4] calldata _podiumTimerCapSec,
        uint256[4] calldata _podiumResetBelowRemainingSec,
        uint256[4] calldata _podiumResetToRemainingSec,
        uint256 _buyCooldownSec,
        address upgradeAdmin
    ) external initializer {
        __Ownable_init(upgradeAdmin);
        require(address(_doub) != address(0), "TimeArena: zero doub");
        require(address(_podiumVaults) != address(0), "TimeArena: zero vaults");
        require(address(_adminSellVault) != address(0), "TimeArena: zero admin vault");
        require(_charmPriceWad > 0, "TimeArena: zero price");
        require(_buyCooldownSec > 0, "TimeArena: zero cooldown");

        ArenaPodiumTimerConfig.validate(
            _podiumTimerExtensionSec,
            _podiumInitialTimerSec,
            _podiumTimerCapSec,
            _podiumResetBelowRemainingSec,
            _podiumResetToRemainingSec
        );

        doub = _doub;
        podiumVaults = _podiumVaults;
        adminSellVault = _adminSellVault;
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
        buyCooldownSec = _buyCooldownSec;
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

    function startArena() external onlyOwner {
        require(arenaStart == 0, "TimeArena: started");
        arenaStart = block.timestamp;
        epochAnchorTimestamp = block.timestamp;
        for (uint8 i; i < NUM_PODIUM_CATEGORIES; ++i) {
            podiumDeadline[i] = block.timestamp + podiumInitialTimerSec[i];
        }
        deadline = podiumDeadline[CAT_LAST_BUYERS];
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
    ///      samples the same TWAP/spot anchor as `_reanchorEpochCharmPrice` **without** writing state.
    ///      Otherwise uses `effectiveCharmPriceWad()` (epoch anchor + 10%/day growth).
    ///      External reads only: Anvil Kumbaya `quoteExactOutput` or MegaETH `ArenaCharmPriceTwap.compute` (#303).
    ///      Integrators: prefer this over `effectiveCharmPriceWad` for swap sizing at the reset boundary.
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

    /// @notice Permissionless DOUB top-up across all eight prize vaults (no admin take; GitLab #261).
    function topUpPodiumPools(uint256 amountDoubWad) external nonReentrant {
        require(amountDoubWad > 0, "TimeArena: zero amount");
        require(arenaStart > 0, "TimeArena: not started");
        uint256 received = _pullDoubExact(msg.sender, amountDoubWad);
        _routeDoubPrizeTopUp(received);
        emit PodiumPoolsToppedUp(msg.sender, received);
    }

    function claimCred(uint256 epoch) external nonReentrant {
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
        require(category < NUM_PODIUM_CATEGORIES, "TimeArena: bad cat");
        require(block.timestamp > podiumDeadline[category], "TimeArena: timer live");

        address[3] memory winners;
        uint256[3] memory values;
        if (category == CAT_LAST_BUYERS) {
            (winners, values) = _lastBuyPodium();
        } else {
            Podium storage p = _podiums[category];
            winners = p.winners;
            values = p.values;
        }

        address poolAddr = podiumVaults.activePools(category);
        uint256 poolBal = doub.balanceOf(poolAddr);
        // WarBow: admin `finalizeWarbowPodium(epoch, …)` pays; roll only clears scores (#252).
        if (category != CAT_WARBOW && poolBal > 0) {
            (uint256 a, uint256 b, uint256 c) = ArenaPodiumSettlement.payoutShares(poolBal);
            podiumVaults.payPodiumWinners(category, winners[0], winners[1], winners[2], a, b, c);
        }
        podiumVaults.rollEpochTranches(category);

        podiumEpoch[category] += 1;
        podiumDeadline[category] = block.timestamp + podiumInitialTimerSec[category];
        if (category == CAT_LAST_BUYERS) {
            deadline = podiumDeadline[category];
        }

        _clearPodium(category);

        if (category == CAT_WARBOW) {
            _clearAllBattlePoints();
        }

        emit PodiumEpochRolled(category, podiumEpoch[category], winners[0], winners[1], winners[2], poolBal);
    }

    function finalizeWarbowPodium(uint256 epoch, address first, address second, address third)
        external
        onlyOwner
    {
        require(!warbowEpochFinalized[epoch], "TimeArena: finalized");
        require(epoch < podiumEpoch[CAT_WARBOW], "TimeArena: bad epoch");
        warbowEpochFinalized[epoch] = true;
        address poolAddr = podiumVaults.activePools(CAT_WARBOW);
        uint256 poolBal = doub.balanceOf(poolAddr);
        if (poolBal > 0) {
            (uint256 a, uint256 b, uint256 c) = ArenaPodiumSettlement.payoutShares(poolBal);
            podiumVaults.payPodiumWinners(CAT_WARBOW, first, second, third, a, b, c);
        }
        emit WarbowPodiumFinalized(epoch, first, second, third);
    }

    function warbowSteal(address victim, bool payBypassBurn) external nonReentrant {
        _requireLive();
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

        uint256 vbp = _effectiveBattlePoints(victim);
        uint256 abp = _effectiveBattlePoints(msg.sender);
        require(abp > 0 && vbp >= 2 * abp && vbp <= 10 * abp, "TimeArena: steal band");

        uint16 bps = block.timestamp < warbowGuardUntil[victim] ? WARBOW_STEAL_DRAIN_GUARDED_BPS : WARBOW_STEAL_DRAIN_BPS;
        uint256 take = Math.mulDiv(vbp, bps, 10_000);
        require(take > 0, "TimeArena: steal zero");
        _subBattlePoints(victim, take);
        _addBattlePoints(msg.sender, take);
        _updateTopThree(CAT_WARBOW, msg.sender, _effectiveBattlePoints(msg.sender));

        if (victimSteals < type(uint8).max) stealsReceivedOnDay[victim][day] = victimSteals + 1;
        if (attackerSteals < type(uint8).max) stealsCommittedByAttackerOnDay[msg.sender][day] = attackerSteals + 1;

        warbowPendingRevengeExpiryExclusive[victim][msg.sender] = block.timestamp + WARBOW_REVENGE_WINDOW_SEC;
        warbowPendingRevengeStealSeq[victim][msg.sender] += 1;

        emit WarBowSteal(msg.sender, victim, take, spent, needBypass);
    }

    function warbowRevenge(address stealer) external nonReentrant {
        _requireLive();
        _requireWarbowLevel(msg.sender);
        uint256 exp = warbowPendingRevengeExpiryExclusive[msg.sender][stealer];
        require(exp != 0 && block.timestamp < exp, "TimeArena: revenge");

        uint256 spent = _pullDoubExact(msg.sender, WARBOW_REVENGE_DOUB);
        uint256 take = Math.mulDiv(_effectiveBattlePoints(stealer), WARBOW_STEAL_DRAIN_BPS, 10_000);
        require(take > 0, "TimeArena: revenge zero");
        _subBattlePoints(stealer, take);
        _addBattlePoints(msg.sender, take);
        _updateTopThree(CAT_WARBOW, msg.sender, _effectiveBattlePoints(msg.sender));
        warbowPendingRevengeExpiryExclusive[msg.sender][stealer] = 0;
        emit WarBowRevenge(msg.sender, stealer, take, spent);
    }

    function warbowActivateGuard() external nonReentrant {
        _requireLive();
        _requireWarbowLevel(msg.sender);
        uint256 spent = _pullDoubExact(msg.sender, WARBOW_GUARD_DOUB);
        warbowGuardUntil[msg.sender] = block.timestamp + WARBOW_GUARD_DURATION_SEC;
        emit WarBowGuard(msg.sender, spent, warbowGuardUntil[msg.sender]);
    }

    function claimWarBowFlag() external nonReentrant {
        _requireLive();
        require(warbowPendingFlagOwner == msg.sender, "TimeArena: not flag holder");
        require(block.timestamp >= warbowPendingFlagPlantAt + WARBOW_FLAG_SILENCE_SEC, "TimeArena: flag silence");
        warbowPendingFlagOwner = address(0);
        warbowPendingFlagPlantAt = 0;
        _addBattlePoints(msg.sender, WARBOW_FLAG_CLAIM_BP);
        _updateTopThree(CAT_WARBOW, msg.sender, _effectiveBattlePoints(msg.sender));
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
        _requireLive();
        require(block.timestamp >= nextBuyAllowedAt[buyer], "TimeArena: buy cooldown");
        _validateCharm(charmWad);

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
        _requireLive();
        require(block.timestamp >= nextBuyAllowedAt[buyer], "TimeArena: buy cooldown");
        _validateCharm(charmWad);
        _prepareBuyBeforeTimer();
        require(address(playCred) != address(0), "TimeArena: no cred");
        uint256 credBurn = Math.mulDiv(charmWad, CRED_PER_CHARM_WAD, WAD);
        require(credBurn > 0, "TimeArena: zero cred burn");
        playCred.burn(buyer, credBurn);
        _accrueCharmOnly(buyer, charmWad);
        _finishBuy(buyer, charmWad, 0, true, false);
    }

    function _finishBuy(address buyer, uint256 charmWad, uint256 received, bool paidWithCred, bool plantWarBowFlag)
        internal
    {
        bool isFirstBuy = buyCount[buyer] == 0;
        buyCount[buyer] += 1;
        _totalBuys += 1;
        nextBuyAllowedAt[buyer] = block.timestamp + buyCooldownSec;

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
                _updateTopThree(CAT_TIME_BOOSTER, buyer, totalEffectiveTimerSecAdded[buyer]);
            }
        }
        if (gateLevel >= 3) {
            _extendPodiumTimer(CAT_DEFENDED_STREAK);
            _processDefendedStreak(buyer, remainingBefore, actualSecondsAdded);
        }
        if (gateLevel >= 4) {
            _extendPodiumTimer(CAT_WARBOW);
            _applyBuyWarBowBp(buyer, remainingBefore, hardReset);
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

    function _extendPodiumTimer(uint8 category) internal {
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

    function _accrueCharmOnly(address buyer, uint256 charmWad) internal {
        uint256 ep = lastBuyEpoch;
        epochCharmWad[ep][buyer] += charmWad;
        epochCharmTotal[ep] += charmWad;
        charmWeight[buyer] += charmWad;
        totalCharmWeight += charmWad;
    }

    function _applyBuyWarBowBp(address buyer, uint256 remainingBefore, bool hardReset) internal {
        uint256 bp = WARBOW_BASE_BUY_BP;
        if (hardReset) bp += WARBOW_TIMER_RESET_BONUS_BP;
        if (remainingBefore < 30) bp += WARBOW_CLUTCH_BONUS_BP;
        _addBattlePoints(buyer, bp);
        _updateTopThree(CAT_WARBOW, buyer, _effectiveBattlePoints(buyer));
    }

    function battlePoints(address user) external view returns (uint256) {
        return _effectiveBattlePoints(user);
    }

    function _routeDoubPrizeSplit(uint256 amount) private returns (uint256 routed) {
        (uint256[4] memory cur, uint256[4] memory nxt, uint256[4] memory nxt2) = ArenaBuyRouting.splitBuyAmount(amount);
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            uint256 ep = podiumEpoch[i];
            if (cur[i] > 0) {
                address pool = podiumVaults.activePools(i);
                doub.safeTransfer(pool, cur[i]);
                podiumVaults.notifyPodiumEpochFunded(i, ep, cur[i], pool);
                routed += cur[i];
            }
            if (nxt[i] > 0) {
                address pool = podiumVaults.seedPools(i);
                doub.safeTransfer(pool, nxt[i]);
                podiumVaults.notifyPodiumEpochFunded(i, ep + 1, nxt[i], pool);
                routed += nxt[i];
            }
            if (nxt2[i] > 0) {
                address pool = podiumVaults.futurePools(i);
                doub.safeTransfer(pool, nxt2[i]);
                podiumVaults.notifyPodiumEpochFunded(i, ep + 2, nxt2[i], pool);
                routed += nxt2[i];
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
        for (uint8 i; i < ArenaBuyRouting.NUM_PODIUMS; ++i) {
            if (act[i] > 0) {
                address pool = podiumVaults.activePools(i);
                doub.safeTransfer(pool, act[i]);
                podiumVaults.notifyPodiumFunded(i, act[i], pool);
                routed += act[i];
            }
            if (sed[i] > 0) {
                address pool = podiumVaults.seedPools(i);
                doub.safeTransfer(pool, sed[i]);
                podiumVaults.notifySeedFunded(i, sed[i], pool);
                routed += sed[i];
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
        if (arenaStart == 0) return false;
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
        require(block.timestamp <= deadline, "TimeArena: timer expired");
    }

    function _validateCharm(uint256 charmWad) internal pure {
        require(charmWad >= CHARM_MIN_WAD && charmWad <= CHARM_MAX_WAD, "TimeArena: charm bounds");
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
            _updateTopThree(CAT_DEFENDED_STREAK, buyer, bestDefendedStreak[buyer]);
        } else if (remainingBefore >= DEFENDED_STREAK_WINDOW_SEC) {
            activeDefendedStreak[buyer] = 0;
        }
    }

    function _updateTopThree(uint8 cat, address entrant, uint256 value) private {
        Podium storage p = _podiums[cat];
        for (uint8 r; r < 3; ++r) {
            if (p.winners[r] == entrant) {
                if (value > p.values[r]) p.values[r] = value;
                _sortPodium(cat);
                return;
            }
        }
        for (uint8 r; r < 3; ++r) {
            if (p.winners[r] == address(0) || value > p.values[r]) {
                p.winners[r] = entrant;
                p.values[r] = value;
                _sortPodium(cat);
                return;
            }
        }
    }

    function _sortPodium(uint8 cat) private {
        Podium storage p = _podiums[cat];
        for (uint8 i; i < 2; ++i) {
            for (uint8 j = i + 1; j < 3; ++j) {
                if (p.values[j] > p.values[i]) {
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

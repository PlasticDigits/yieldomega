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
import {PodiumVaults} from "./PodiumVaults.sol";
import {AdminSellVault} from "./AdminSellVault.sol";
import {IReferralRegistry} from "../interfaces/IReferralRegistry.sol";

/// @title TimeArena — persistent PvP timer arena (Arena v2)
/// @notice DOUB-priced CHARM buys; Last Buy timer; per-buy DOUB prize routing. See `docs/product/arena-v2.md`.
contract TimeArena is Initializable, OwnableUpgradeable, ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;

    uint8 public constant CAT_LAST_BUYERS = 0;
    uint8 public constant CAT_TIME_BOOSTER = 1;
    uint8 public constant CAT_DEFENDED_STREAK = 2;
    uint8 public constant CAT_WARBOW = 3;
    uint8 public constant NUM_PODIUM_CATEGORIES = 4;

    uint256 public constant DEFENDED_STREAK_WINDOW_SEC = 900;
    uint256 public constant TIMER_RESET_BELOW_REMAINING_SEC = 780;
    uint256 public constant TIMER_RESET_TO_REMAINING_SEC = 900;
    uint16 public constant REFERRAL_EACH_BPS = 500;

    uint256 internal constant WAD = 1e18;
    uint256 internal constant CHARM_MIN_WAD = 99e16;
    uint256 internal constant CHARM_MAX_WAD = 10e18;

    IERC20 public doub;
    PodiumVaults public podiumVaults;
    AdminSellVault public adminSellVault;
    IReferralRegistry public referralRegistry;

    uint256 public charmPriceWad;
    uint256 public timerExtensionSec;
    uint256 public initialTimerSec;
    uint256 public timerCapSec;
    uint256 public buyCooldownSec;

    uint256 public arenaStart;
    uint256 public deadline;
    uint256 public lastBuyEpoch;
    uint256 public totalDoubRaised;
    uint256 public totalCharmWeight;
    bool public paused;

    mapping(address => uint256) public charmWeight;
    mapping(address => uint256) public buyCount;
    mapping(address => uint256) public nextBuyAllowedAt;
    mapping(address => uint256) public totalEffectiveTimerSecAdded;
    mapping(address => uint256) public bestDefendedStreak;
    mapping(address => uint256) public activeDefendedStreak;

    struct Podium {
        address[3] winners;
        uint256[3] values;
    }

    Podium[3] internal _podiums;
    address[3] internal _lastBuyers;
    uint8 internal _lastBuyerIdx;
    uint256 internal _totalBuys;
    address internal _dsLastUnderWindowBuyer;

    event ArenaStarted(uint256 startTimestamp, uint256 initialDeadline);
    event LastBuyEpochStarted(uint256 indexed epoch, uint256 deadline);
    event Buy(
        address indexed buyer,
        uint256 charmWad,
        uint256 doubPaid,
        uint256 newDeadline,
        uint256 totalDoubRaisedAfter,
        uint256 buyIndex,
        uint256 actualSecondsAdded,
        bool timerHardReset
    );
    event ReferralApplied(
        address indexed buyer,
        address indexed referrer,
        bytes32 indexed codeHash,
        uint256 referrerCharm,
        uint256 buyerCharm,
        uint256 doubPaid
    );
    event PausedSet(bool paused);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        IERC20 _doub,
        PodiumVaults _podiumVaults,
        AdminSellVault _adminSellVault,
        address _referralRegistry,
        uint256 _charmPriceWad,
        uint256 _timerExtensionSec,
        uint256 _initialTimerSec,
        uint256 _timerCapSec,
        uint256 _buyCooldownSec,
        address upgradeAdmin
    ) external initializer {
        __Ownable_init(upgradeAdmin);
        require(address(_doub) != address(0), "TimeArena: zero doub");
        require(address(_podiumVaults) != address(0), "TimeArena: zero vaults");
        require(address(_adminSellVault) != address(0), "TimeArena: zero admin vault");
        require(_charmPriceWad > 0, "TimeArena: zero price");
        require(_buyCooldownSec > 0, "TimeArena: zero cooldown");

        doub = _doub;
        podiumVaults = _podiumVaults;
        adminSellVault = _adminSellVault;
        if (_referralRegistry != address(0)) {
            referralRegistry = IReferralRegistry(_referralRegistry);
        }
        charmPriceWad = _charmPriceWad;
        timerExtensionSec = _timerExtensionSec;
        initialTimerSec = _initialTimerSec;
        timerCapSec = _timerCapSec;
        buyCooldownSec = _buyCooldownSec;
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}

    function setPaused(bool p) external onlyOwner {
        paused = p;
        emit PausedSet(p);
    }

    function setCharmPriceWad(uint256 wad) external onlyOwner {
        require(wad > 0, "TimeArena: zero price");
        charmPriceWad = wad;
    }

    function startArena() external onlyOwner {
        require(arenaStart == 0, "TimeArena: started");
        arenaStart = block.timestamp;
        deadline = block.timestamp + initialTimerSec;
        emit ArenaStarted(arenaStart, deadline);
    }

    function buy(uint256 charmWad) external nonReentrant {
        _buy(msg.sender, charmWad, bytes32(0));
    }

    function buy(uint256 charmWad, bytes32 codeHash) external nonReentrant {
        _buy(msg.sender, charmWad, codeHash);
    }

    function _buy(address buyer, uint256 charmWad, bytes32 codeHash) internal {
        require(arenaStart > 0, "TimeArena: not started");
        require(!paused, "TimeArena: paused");
        require(block.timestamp >= nextBuyAllowedAt[buyer], "TimeArena: buy cooldown");
        require(charmWad >= CHARM_MIN_WAD && charmWad <= CHARM_MAX_WAD, "TimeArena: charm bounds");
        require(block.timestamp <= deadline, "TimeArena: timer expired");

        if (codeHash != bytes32(0)) {
            require(address(referralRegistry) != address(0), "TimeArena: referral disabled");
        }

        uint256 doubOwed = Math.mulDiv(charmWad, charmPriceWad, WAD);
        require(doubOwed > 0, "TimeArena: zero pay");

        uint256 received = _pullDoubExact(buyer, doubOwed);

        if (codeHash != bytes32(0)) {
            address referrer = referralRegistry.ownerOfCode(codeHash);
            require(referrer != address(0), "TimeArena: invalid referral");
            require(referrer != buyer, "TimeArena: self-referral");
            uint256 refEach = (charmWad * uint256(REFERRAL_EACH_BPS)) / 10_000;
            require(refEach > 0 && refEach * 2 <= charmWad, "TimeArena: referral amount");
            charmWeight[referrer] += refEach;
            charmWeight[buyer] += refEach;
            totalCharmWeight += refEach * 2;
            emit ReferralApplied(buyer, referrer, codeHash, refEach, refEach, received);
        }

        charmWeight[buyer] += charmWad;
        totalCharmWeight += charmWad;

        uint256 toVaults = _routeDoubPrizeSplit(received);
        require(toVaults == received, "TimeArena: routing");

        totalDoubRaised += received;
        buyCount[buyer] += 1;
        _totalBuys += 1;
        nextBuyAllowedAt[buyer] = block.timestamp + buyCooldownSec;

        uint256 deadlineBefore = deadline;
        uint256 remainingBefore = deadlineBefore > block.timestamp ? deadlineBefore - block.timestamp : 0;

        (uint256 newDl, bool hardReset) = TimeMath.extendDeadlineOrResetBelowThreshold(
            deadlineBefore,
            block.timestamp,
            timerExtensionSec,
            timerCapSec,
            TIMER_RESET_BELOW_REMAINING_SEC,
            TIMER_RESET_TO_REMAINING_SEC
        );
        deadline = newDl;
        if (hardReset) {
            lastBuyEpoch += 1;
            emit LastBuyEpochStarted(lastBuyEpoch, deadline);
        }

        uint256 actualSecondsAdded = deadline > deadlineBefore ? deadline - deadlineBefore : 0;
        _trackLastBuyer(buyer);

        if (actualSecondsAdded > 0) {
            totalEffectiveTimerSecAdded[buyer] += actualSecondsAdded;
            _updateTopThree(CAT_TIME_BOOSTER, buyer, totalEffectiveTimerSecAdded[buyer]);
        }
        _processDefendedStreak(buyer, remainingBefore, actualSecondsAdded);

        emit Buy(
            buyer,
            charmWad,
            received,
            deadline,
            totalDoubRaised,
            _totalBuys,
            actualSecondsAdded,
            hardReset
        );
    }

    function _routeDoubPrizeSplit(uint256 amount) private returns (uint256 routed) {
        (uint256[4] memory act, uint256[4] memory sed, uint256 adminShare) = ArenaBuyRouting.splitBuyAmount(amount);
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
        if (adminShare > 0) {
            doub.safeTransfer(address(adminSellVault), adminShare);
            adminSellVault.notifyFunded(adminShare);
            routed += adminShare;
        }
    }

    function _pullDoubExact(address from, uint256 expected) private returns (uint256 received) {
        uint256 balBefore = doub.balanceOf(address(this));
        doub.safeTransferFrom(from, address(this), expected);
        received = doub.balanceOf(address(this)) - balBefore;
        require(received == expected, "TimeArena: ERC20 parity");
    }

    function _trackLastBuyer(address buyer) private {
        _lastBuyerIdx = uint8((_lastBuyerIdx + 1) % 3);
        _lastBuyers[_lastBuyerIdx] = buyer;
        _updateTopThree(CAT_LAST_BUYERS, buyer, buyCount[buyer]);
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
        if (cat == CAT_WARBOW) return;
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

    function podium(uint8 category) external view returns (address[3] memory winners, uint256[3] memory values) {
        require(category < NUM_PODIUM_CATEGORIES && category != CAT_WARBOW, "TimeArena: bad cat");
        Podium storage p = _podiums[category];
        return (p.winners, p.values);
    }

    function lastBuyers() external view returns (address[3] memory) {
        return _lastBuyers;
    }
}

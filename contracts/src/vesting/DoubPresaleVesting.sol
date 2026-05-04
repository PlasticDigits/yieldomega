// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

/// @title DoubPresaleVesting — DOUB presale allocations with cliff + linear vesting
/// @notice Immutable beneficiary set and per-address allocations fixed at deploy. The owner starts vesting once;
///         each beneficiary may claim according to the schedule below.
///
///         When **`TimeCurve.doubPresaleVesting`** points at this contract (proxy), **beneficiaries** also earn a **+15%**
///         **CHARM weight** bonus on each TimeCurve buy's purchased `charmWad` (see `TimeCurve.PRESALE_CHARM_WEIGHT_BPS`).
///
/// ## Schedule (per beneficiary)
/// - **Cliff:** **30%** of `allocation` becomes vested at `vestingStart` (TGE).
/// - **Linear:** the remaining **70%** (implicitly `allocation - cliffAmount`) vests linearly in time from
///   `vestingStart` through `vestingStart + vestingDuration`, inclusive of continuous per-second accrual via
///   `mulDiv` (no further cliff on the linear tranche).
///
/// ## Invariants
/// - **Allocation totals:** `sum(amounts) == requiredTotalAllocation` (`initialize`); otherwise revert.
/// - **Unique beneficiaries:** each `beneficiaries[i]` is unique and non-zero; duplicates revert.
/// - **Non-zero schedule:** `vestingDuration > 0`; `requiredTotalAllocation > 0`; every `amounts[i] > 0`.
/// - **Enumerable set:** the contract holds an `EnumerableSet.AddressSet` mirroring beneficiaries for O(1) membership and O(n) enumeration.
/// - **Funding:** `startVesting` requires `token.balanceOf(this) >= totalAllocated` so claims cannot exceed funded DOUB.
///   Funding assumes **canonical ERC20** transfers (ingress parity on pulling contracts such as `TimeCurve` / Burrow — [GitLab #123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).
/// - **Claim bound:** cumulative claims per address never exceed `allocation[address]`; vested never exceeds allocation at any time.
/// - **Single start:** `startVesting` succeeds at most once.
/// - **Claims gate:** `claim` is blocked until `claimsEnabled` is set `true` by the owner (final signoff / operational go-live) — `docs/operations/final-signoff-and-value-movement.md` ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)).
/// - **Owner rescue (`rescueERC20`, [GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137)):** `onlyOwner` may sweep **excess** vesting **`token`** (balance above **`totalAllocated − Σ claimedOf`** over beneficiaries) and **full** balances of **other** ERC20s sent by mistake — aligned with **`FeeRouter` / `TimeCurveBuyRouter`** recovery precedent ([issue #117](https://gitlab.com/PlasticDigits/yieldomega/-/issues/117)); does not weaken per-beneficiary claim caps ([issue #123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123) ingress assumptions unchanged).
///
/// ## Rounding
/// Cliff uses `mulDiv(allocation, 3000, 10000)`. Linear tranche uses `allocation - cliff` as cap so `cliff + linearCap == allocation`.
/// Per-second vesting rounds down; dust remains until the end timestamp where the full linear tranche is released.
///
/// Production: UUPS proxy; **proxy address** is canonical (GitLab #54).
/// **Frontend:** [`docs/frontend/presale-vesting.md`](../../../docs/frontend/presale-vesting.md) — hidden `/vesting` route (GitLab #92).
contract DoubPresaleVesting is Initializable, OwnableUpgradeable, ReentrancyGuard, UUPSUpgradeable {
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;

    IERC20 public token;
    /// @notice Sum of all beneficiary allocations (equals `requiredTotalAllocation` from initializer).
    uint256 public totalAllocated;
    /// @notice Linear vesting duration after `vestingStart` (seconds). Canonical presale: **180 days**.
    uint256 public vestingDuration;

    uint256 internal constant CLIFF_BPS = 3000; // 30%

    EnumerableSet.AddressSet private _beneficiarySet;
    mapping(address beneficiary => uint256 amount) public allocationOf;
    mapping(address beneficiary => uint256 claimed) public claimedOf;

    uint256 public vestingStart;

    /// @notice When `false`, `claim` reverts even if `vestingStart` is set and the beneficiary has a balance (see issue #55).
    bool public claimsEnabled;

    event VestingStarted(uint256 startTimestamp, uint256 durationSec, uint256 totalAllocated_);
    event Claimed(address indexed beneficiary, uint256 amount);
    event ClaimsEnabled(bool enabled);
    /// @notice Owner recovery sweep. `kind`: **0** = vesting-token excess only; **1** = non-vesting token (full balance subject to `amount`).
    event RescueERC20(address indexed token, address indexed to, uint256 amount, uint8 kind);

    error DoubVesting__ZeroToken();
    error DoubVesting__ArrayLengthMismatch();
    error DoubVesting__ZeroDuration();
    error DoubVesting__ZeroTotal();
    error DoubVesting__ZeroBeneficiary();
    error DoubVesting__ZeroAllocation();
    error DoubVesting__DuplicateBeneficiary(address who);
    error DoubVesting__TotalMismatch(uint256 computedSum, uint256 requiredTotal);
    error DoubVesting__NotBeneficiary();
    error DoubVesting__AlreadyStarted();
    error DoubVesting__NotStarted();
    error DoubVesting__Underfunded(uint256 balance, uint256 needed);
    error DoubVesting__NothingToClaim();
    error DoubVesting__ClaimsNotEnabled();
    error DoubVesting__RescueZeroRecipient();
    error DoubVesting__RescueZeroAmount();
    error DoubVesting__RescueExceedsExcess(uint256 maxExcess, uint256 attempted);
    error DoubVesting__RescueExceedsBalance(uint256 balance, uint256 attempted);
    error DoubVesting__RescueUndercollateralized(uint256 balance, uint256 reserveNeeded);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /// @param doubToken DOUB (or test ERC20) held by this contract when vesting starts.
    /// @param initialOwner Admin that may call `startVesting` exactly once.
    /// @param beneficiaries Unique addresses; order is not preserved in enumeration (set semantics).
    /// @param amounts Per-beneficiary DOUB allocations (wei); must sum to `requiredTotalAllocation`.
    /// @param requiredTotalAllocation Must equal `sum(amounts)`; use e.g. **21_500_000e18** for canonical presale bucket.
    /// @param vestingDurationSec Linear window for the 70% tranche (e.g. **180 days** in seconds).
    function initialize(
        IERC20 doubToken,
        address initialOwner,
        address[] memory beneficiaries,
        uint256[] memory amounts,
        uint256 requiredTotalAllocation,
        uint256 vestingDurationSec
    ) external initializer {
        if (address(doubToken) == address(0)) revert DoubVesting__ZeroToken();
        if (beneficiaries.length != amounts.length) revert DoubVesting__ArrayLengthMismatch();
        if (vestingDurationSec == 0) revert DoubVesting__ZeroDuration();
        if (requiredTotalAllocation == 0) revert DoubVesting__ZeroTotal();

        __Ownable_init(initialOwner);
        token = doubToken;
        vestingDuration = vestingDurationSec;

        uint256 sum;
        uint256 n = beneficiaries.length;
        for (uint256 i; i < n; ++i) {
            address b = beneficiaries[i];
            uint256 a = amounts[i];
            if (b == address(0)) revert DoubVesting__ZeroBeneficiary();
            if (a == 0) revert DoubVesting__ZeroAllocation();
            if (!_beneficiarySet.add(b)) revert DoubVesting__DuplicateBeneficiary(b);
            allocationOf[b] = a;
            sum += a;
        }

        if (sum != requiredTotalAllocation) revert DoubVesting__TotalMismatch(sum, requiredTotalAllocation);
        totalAllocated = sum;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /// @notice Turn user `claim` on after operational / governance final signoff (independent of `vestingStart`).
    function setClaimsEnabled(bool enabled) external onlyOwner {
        claimsEnabled = enabled;
        emit ClaimsEnabled(enabled);
    }

    /// @notice Number of beneficiaries (size of the enumerable set).
    function beneficiaryCount() external view returns (uint256) {
        return _beneficiarySet.length();
    }

    /// @notice Enumerate beneficiary at `index` in `[0, beneficiaryCount)` (order not stable across versions).
    function beneficiaryAt(uint256 index) external view returns (address) {
        return _beneficiarySet.at(index);
    }

    /// @return True if `account` is in the beneficiary set.
    function isBeneficiary(address account) external view returns (bool) {
        return _beneficiarySet.contains(account);
    }

    /// @dev O(n) over beneficiaries. Matches `Σ allocation − Σ claimed` = DOUB that could still be claimed in aggregate (each beneficiary is capped at `allocation − claimed`).
    function totalClaimedAcrossBeneficiaries() public view returns (uint256 sum) {
        uint256 n = _beneficiarySet.length();
        for (uint256 i; i < n; ++i) {
            sum += claimedOf[_beneficiarySet.at(i)];
        }
    }

    /// @notice Minimum DOUB balance that must remain when rescuing the vesting `token` so outstanding claims stay fundable.
    function reserveDoubForOutstandingClaimsWad() public view returns (uint256) {
        return totalAllocated - totalClaimedAcrossBeneficiaries();
    }

    /// @notice Vested amount for `account` at timestamp `t` (does not subtract claimed).
    function vestedAt(address account, uint256 t) public view returns (uint256) {
        uint256 alloc = allocationOf[account];
        if (alloc == 0) return 0;
        uint256 start = vestingStart;
        if (start == 0 || t < start) return 0;

        uint256 cliff = Math.mulDiv(alloc, CLIFF_BPS, 10_000);
        uint256 linearCap = alloc - cliff;
        uint256 elapsed = t - start;
        if (elapsed >= vestingDuration) {
            return alloc;
        }
        uint256 linearReleased = Math.mulDiv(linearCap, elapsed, vestingDuration);
        return cliff + linearReleased;
    }

    /// @notice Claimable DOUB for `account` at timestamp `t`.
    function claimableAt(address account, uint256 t) public view returns (uint256) {
        uint256 v = vestedAt(account, t);
        uint256 c = claimedOf[account];
        return v > c ? v - c : 0;
    }

    /// @notice Current claimable amount for `msg.sender`.
    function claimable(address account) external view returns (uint256) {
        return claimableAt(account, block.timestamp);
    }

    /// @notice Sets `vestingStart` to `block.timestamp` and requires full funding. Callable once by owner.
    function startVesting() external onlyOwner {
        if (vestingStart != 0) revert DoubVesting__AlreadyStarted();
        uint256 bal = token.balanceOf(address(this));
        if (bal < totalAllocated) revert DoubVesting__Underfunded(bal, totalAllocated);
        vestingStart = block.timestamp;
        emit VestingStarted(vestingStart, vestingDuration, totalAllocated);
    }

    /// @notice Claim all currently claimable DOUB for the caller.
    function claim() external nonReentrant {
        if (vestingStart == 0) revert DoubVesting__NotStarted();
        if (!claimsEnabled) revert DoubVesting__ClaimsNotEnabled();
        if (!_beneficiarySet.contains(msg.sender)) revert DoubVesting__NotBeneficiary();

        uint256 amount = claimableAt(msg.sender, block.timestamp);
        if (amount == 0) revert DoubVesting__NothingToClaim();

        claimedOf[msg.sender] += amount;
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Owner-only ERC20 recovery. **Vesting `token`:** may move only balance above `reserveDoubForOutstandingClaimsWad()` (excess / mistaken over-funding). **Any other token:** may move up to `balanceOf(this)` (stranded dust).
    /// @dev `amount == type(uint256).max` sends the full allowed amount for that branch. Zero `amount` reverts; zero `to` reverts.
    function rescueERC20(IERC20 t, address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert DoubVesting__RescueZeroRecipient();
        if (amount == 0) revert DoubVesting__RescueZeroAmount();
        if (address(t) == address(0)) revert DoubVesting__ZeroToken();

        uint256 bal = t.balanceOf(address(this));
        uint256 send;
        uint8 kind;

        if (address(t) == address(token)) {
            uint256 reserve = reserveDoubForOutstandingClaimsWad();
            if (bal < reserve) revert DoubVesting__RescueUndercollateralized(bal, reserve);
            uint256 maxExcess = bal - reserve;
            send = amount == type(uint256).max ? maxExcess : amount;
            if (send > maxExcess) revert DoubVesting__RescueExceedsExcess(maxExcess, send);
            kind = 0;
        } else {
            send = amount == type(uint256).max ? bal : amount;
            if (send > bal) revert DoubVesting__RescueExceedsBalance(bal, send);
            kind = 1;
        }

        if (send == 0) return;

        t.safeTransfer(to, send);
        emit RescueERC20(address(t), to, send, kind);
    }

    uint256[49] private __gap;
}

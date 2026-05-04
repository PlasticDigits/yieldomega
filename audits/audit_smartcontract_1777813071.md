# Internal Smart Contract Audit

Audit file: `audits/audit_smartcontract_1777813071.md`  
Date: 2026-05-03  
Reviewer: Cursor agent, internal review  
Scope: first-party EVM Solidity contracts under `contracts/src`

## Executive Summary

This review covered the Yieldomega smart contracts only: TimeCurve, RabbitTreasury, FeeRouter, TimeCurveBuyRouter, FeeSink/PodiumPool sinks, ReferralRegistry, DoubPresaleVesting, Doubloon, LeprechaunNFT, pricing, math libraries, and Anvil-only fixtures. Third-party dependencies under `contracts/lib`, frontend, indexer, bots, deployment shell scripts, and offchain infrastructure were not audited except where they clarify contract assumptions.

No critical unprivileged path was found that lets an attacker directly extract net assets from TimeCurve, RabbitTreasury, vesting, or fee routing under the documented standard-ERC20 and trusted-admin assumptions. The most important residual risks are governance/upgrade centralization, prize-pool slices being left locked when a podium category has no winners, and TimeCurveBuyRouter's handling of pre-existing token balances.

Automated check performed:

```bash
cd contracts
FOUNDRY_PROFILE=ci FOUNDRY_OUT=/tmp/yieldomega-forge-out FOUNDRY_CACHE_PATH=/tmp/yieldomega-forge-cache forge test -vv
```

Result: 210 tests passed, 0 failed, 0 skipped. A default run without temp paths failed before test execution because `contracts/out` was not writable in this local checkout.

## Contracts Reviewed

- `contracts/src/TimeCurve.sol`
- `contracts/src/TimeCurveBuyRouter.sol`
- `contracts/src/RabbitTreasury.sol`
- `contracts/src/FeeRouter.sol`
- `contracts/src/vesting/DoubPresaleVesting.sol`
- `contracts/src/ReferralRegistry.sol`
- `contracts/src/LeprechaunNFT.sol`
- `contracts/src/tokens/Doubloon.sol`
- `contracts/src/tokens/MockCL8Y.sol`
- `contracts/src/sinks/FeeSink.sol`
- `contracts/src/sinks/PodiumPool.sol`
- `contracts/src/sinks/CL8YProtocolTreasury.sol`
- `contracts/src/sinks/DoubLPIncentives.sol`
- `contracts/src/sinks/EcosystemTreasury.sol`
- `contracts/src/pricing/LinearCharmPrice.sol`
- `contracts/src/libraries/FeeMath.sol`
- `contracts/src/libraries/TimeMath.sol`
- `contracts/src/libraries/BurrowMath.sol`
- `contracts/src/interfaces/ICharmPrice.sol`
- `contracts/src/interfaces/IReferralRegistry.sol`
- `contracts/src/fixtures/AnvilKumbayaFixture.sol` (fixture only)

## Severity Findings

### H-01: Privileged upgrade and parameter roles can alter core economics without onchain delay

Affected contracts:

- `TimeCurve`
- `LinearCharmPrice`
- `RabbitTreasury`
- `FeeRouter`
- `Doubloon`
- `DoubPresaleVesting`
- `ReferralRegistry`
- `FeeSink` derivatives
- `PodiumPool`
- `LeprechaunNFT`

The production contracts are heavily admin-governed. UUPS owners/admins can upgrade implementations. `FeeRouter` governors can redirect all future routed fees. `RabbitTreasury` `PARAMS_ROLE` can change repricing and withdrawal parameters. `Doubloon` admins can grant `MINTER_ROLE`. NFT admins can mutate metadata base URI and minter roles.

This is not an unprivileged exploit, but it is a high-severity trust assumption: a compromised or malicious privileged account can redirect value, brick flows, mint DOUB if it controls token roles, change redemption economics, or alter metadata. The code does not enforce multisig, timelock, two-step changes, role separation, or sale/epoch-scoped parameter locks.

Recommendation:

- Use audited multisig/timelock governance for all upgrade/admin roles before mainnet.
- Add onchain delay or staged proposal/acceptance for fee sink updates, RabbitTreasury parameter changes, and upgrades.
- Snapshot or lock sale-critical TimeCurve dependencies, including pricing implementation, before a sale starts.
- Document all privileged roles and rotate deployer EOAs out of production roles.

### M-01: `TimeCurve.distributePrizes` can mark distribution complete while leaving empty-category slices locked

Affected contract: `TimeCurve`

`distributePrizes` computes four category slices from the full `PodiumPool` balance and then sets `prizesDistributed = true` before paying each category. `_payPodiumFrom` silently skips placements whose winner is `address(0)`. If a category has no winners, that entire category slice remains in `PodiumPool`, while `prizesDistributed` prevents a later retry.

This is likely in realistic rounds: the defended-streak podium only fills if buys occur inside the under-15-minute window, and some time-booster edge cases can produce no winner. The existing tests assert that the vault balance decreases, not that all intended distributable funds leave or that empty category slices are handled by an explicit policy.

Impact:

- CL8Y reserve assets can become permanently stranded in `PodiumPool`.
- Participants may receive less than the documented prize pool.
- Operators cannot retry distribution without an upgrade or out-of-band migration.

Recommendation:

- Decide a policy for empty podium categories: redistribute to filled categories, roll to protocol, roll to next round, or leave retryable.
- Do not set `prizesDistributed` until all nonzero category slices have an explicit destination.
- Add tests where `CAT_DEFENDED_STREAK` and/or `CAT_TIME_BOOSTER` have zero winners and assert final pool balance or documented residual policy.

### M-02: `TimeCurveBuyRouter` lets the current caller receive pre-existing WETH/stable balances

Affected contract: `TimeCurveBuyRouter`

After a Kumbaya exact-output swap, the router refunds the entire WETH or stable token balance of the router to the current caller. This includes balances that existed before the current transaction, not only the current caller's unused input. Anyone can transfer ERC20 tokens to the router address before a later buy. A later buyer can receive those stranded WETH/stable balances as part of the refund path.

The CL8Y side intentionally routes all remaining CL8Y to `cl8yProtocolTreasury`, including pre-seeded CL8Y, and this behavior is covered by tests. There is no equivalent explicit policy for WETH/stable balances.

Impact:

- Does not let an attacker steal core TimeCurve funds.
- Does let a caller extract accidentally or maliciously pre-seeded WETH/stable balances from the router.
- Makes router balance accounting depend on "should never hold tokens" assumptions that are not enforced.

Recommendation:

- Refund only `balanceAfter - balanceBefore` for the input token, or track exact router spend/unused input from `exactOutput`.
- Add a rescue function gated by governance for unrelated stuck tokens.
- Add tests for pre-seeded WETH/stable balances.

### M-03: `RabbitTreasury` parameter setters lack bounds for several math-critical values

Affected contract: `RabbitTreasury`

`setCStarWad`, `setAlphaWad`, `setBetaWad`, `setLamWad`, and `setDeltaMaxFracWad` accept arbitrary values. `setMBoundsWad`, fee setters, and minimum-efficiency setters have some validation, but the remaining values can still make epoch finalization revert, produce extreme exchange-rate moves, or create unintuitive redemption behavior.

This is privileged, but operationally important because `finalizeEpoch` is permissionless and depends on these values after the role holder updates them.

Recommendation:

- Add explicit upper/lower bounds matching the simulation envelope in `contracts/PARAMETERS.md`.
- Add tests that parameter updates cannot make `finalizeEpoch` revert under normal supply/backing ranges.
- Consider delayed activation by next epoch rather than immediate mutation.

### L-01: TimeCurveBuyRouter does not fail early for scheduled, not-yet-live sales

Affected contract: `TimeCurveBuyRouter`

`buyViaKumbaya` checks `saleStart() != 0`, `!ended()`, and `block.timestamp < deadline()`, but it does not check `block.timestamp >= saleStart()`. For a scheduled future sale, the router may proceed through path validation and swap calls before `TimeCurve.buyFor` reverts with `sale not live`.

Because the final revert rolls back the transaction, no net user funds should be lost. The issue is wasted gas and an avoidable external call before discovering the sale is not live.

Recommendation:

- Add `block.timestamp >= tc.saleStart()` to the router sale-phase check.
- Add a future-sale router test mirroring the direct TimeCurve pre-start test.

### L-02: Referral code registration is front-runnable

Affected contract: `ReferralRegistry`

`registerCode(string)` reveals the normalized code in calldata and assigns ownership immediately. A mempool observer can front-run a desirable code registration, pay the burn, and claim the code first.

Impact is limited to code squatting/griefing and does not steal existing protocol funds, but referral names are user-facing and may have economic value.

Recommendation:

- If code ownership matters economically, use commit-reveal registration or signed offchain reservations.
- If front-running is acceptable, document "first included transaction wins" in referral UX and docs.

### L-03: Several AccessControl deployments do not reject zero admin addresses

Affected contracts:

- `RabbitTreasury`
- `FeeRouter`
- `PodiumPool`
- `FeeSink` derivatives
- `Doubloon`
- `LeprechaunNFT`

Ownable-based initializers generally rely on OpenZeppelin zero-owner checks, but AccessControl grants do not consistently reject a zero `admin` in this code. A zero admin can permanently brick role administration or create a deployment with no usable privileged account.

Recommendation:

- Add `require(admin != address(0))` or equivalent to AccessControl constructors/initializers.
- Add deployment-script and unit-test coverage for zero-admin rejection.

### L-04: Public fee distribution and sink withdrawals depend on correct token/sink choices

Affected contracts:

- `FeeRouter`
- `FeeSink`
- `PodiumPool`

`FeeRouter.distributeFees` is intentionally permissionless and sends any token balance held by the router to configured sinks. Fee sinks then allow governed withdrawals. This supports liveness and dust cleanup, but means any accidental ERC20 sent to the router can be routed to the configured sinks by anyone.

Recommendation:

- Keep documenting that `FeeRouter` is not a custody contract.
- Consider an allowlist or rescue policy if third-party tokens are likely to be sent accidentally.

### L-05: Standard-ERC20 assumptions are security-critical

Affected contracts:

- `TimeCurve`
- `TimeCurveBuyRouter`
- `RabbitTreasury`
- `FeeRouter`
- `ReferralRegistry`
- `DoubPresaleVesting`
- `FeeSink`/`PodiumPool`

The contracts use `SafeERC20`, but accounting generally uses requested amounts rather than received balance deltas. Existing tests cover fee-on-transfer and rebasing risks, and docs state that CL8Y/reserve assets must be standard ERC20 tokens. This remains a deployment invariant, not an onchain-enforced property.

Recommendation:

- Treat reserve/accepted assets as an allowlisted deployment parameter.
- Do not deploy with fee-on-transfer, rebasing, ERC777-hooked, pausable, blacklistable, or upgradeable third-party tokens unless the risk is explicitly accepted.
- For future multi-asset support, measure balance deltas or isolate adapters per asset type.

### I-01: Long-running TimeCurve math can eventually revert for extreme elapsed/growth values

Affected contracts:

- `TimeMath`
- `LinearCharmPrice`
- `TimeCurve`

`TimeMath.currentMinBuy` computes an exponential using PRB math. Very large `growthRateWad * elapsed` values can overflow or exceed the exponent domain, causing views and buys to revert. `LinearCharmPrice.priceWad` can also overflow for extreme elapsed or daily increment values.

This is not expected under current sale timing assumptions, but it is a latent denial-of-service boundary if a sale is extended or left open far beyond expected duration.

Recommendation:

- Bound accepted growth and pricing parameters at deployment.
- Add maximum elapsed behavior or explicit "sale too old" behavior if very long sales are possible.

### I-02: NFT metadata remains admin-mutable

Affected contract: `LeprechaunNFT`

`setBaseURI` allows the admin to change offchain metadata URI roots. Onchain trait storage remains authoritative for stored traits, but image/metadata presentation can drift.

Recommendation:

- If immutability is desired, add a URI freeze switch or per-series provenance commitment.
- If mutability is intended, disclose admin control to holders.

## Top 20 Solidity Bug-Class Checklist

| # | Bug class | Result |
|---|-----------|--------|
| 1 | Reentrancy | Core external-value paths mostly use CEI and/or `nonReentrant` where highest risk (`TimeCurve`, router, vesting). `RabbitTreasury.withdraw` is not `nonReentrant`, but it burns/updates before transfer and assumes standard ERC20. Residual risk: non-standard/malicious reserve token. |
| 2 | Missing access control | No unprotected admin functions found. Main issue is strong centralized admin/upgrade power, not missing modifiers. |
| 3 | Arithmetic overflow/underflow | Solidity 0.8 checks are used. Long-running exponential/linear math has domain/overflow boundaries. |
| 4 | Unchecked ERC20 returns | `SafeERC20` is consistently used where IERC20 transfers are performed. |
| 5 | `tx.origin` authentication | Not used. |
| 6 | Timestamp dependence | Intentional for sale deadlines, cooldowns, vesting, epochs, and WarBow. Miner/validator timestamp influence is limited but same-block ordering remains part of game design. |
| 7 | Insecure randomness | No randomness used. Podiums are deterministic. |
| 8 | Front-running/MEV | Last-buyer, timer, WarBow, and referral code registration are front-runnable by design or residual risk. Referral registration has no commit-reveal. |
| 9 | DoS via unbounded loops | Most runtime loops are fixed-size. Vesting initializer loops over beneficiary arrays at deployment only. ERC721Enumerable can be gas-heavy but not directly fund-critical. |
| 10 | DoS via external calls | Token transfers to sinks/podium winners can revert and block buys/distribution if the token or recipient behavior is incompatible. Tests cover several non-standard-token reverts. |
| 11 | Locked funds | `TimeCurve.distributePrizes` can lock empty-category slices; router can hold or sweep stray assets; no rescue path in `TimeCurveBuyRouter`. |
| 12 | Approval/allowance hazards | Router correctly resets approvals with `forceApprove`. Standard ERC20 allowance UX risks remain external. |
| 13 | Upgrade storage layout | UUPS gaps exist. No historical-layout validation was performed in this audit. Use OpenZeppelin upgrade checks before every upgrade. |
| 14 | Uninitialized implementation/proxy | Implementations disable initializers. Deployment must still use ERC1967 proxy addresses, not implementation addresses. |
| 15 | Oracle/price manipulation | No external oracle in current contracts. TimeCurve uses owner-selected `ICharmPrice`; RabbitTreasury reprices from onchain accounting parameters. Governance mutation is the risk. |
| 16 | Non-standard ERC20 behavior | Documented and partially tested. Not fully enforced onchain. |
| 17 | Signature replay | No signature-based authorization found. |
| 18 | Force ETH / unsolicited token griefing | `TimeCurveBuyRouter` can receive ETH and ERC20s; pre-existing WETH/stable can be refunded to a later caller, and pre-existing CL8Y is swept to protocol treasury. |
| 19 | Input validation | Most critical constructor/initializer values are checked. Gaps remain for zero AccessControl admins and some RabbitTreasury parameter setters. |
| 20 | Precision/rounding | FeeRouter remainder goes to last sink; vesting rounds down until full duration; TimeCurve redemption and prize splits can leave dust or zero claims in edge cases. Empty-category prize slices need explicit handling. |

## Invariant Review

### TimeCurve

Reviewed invariants:

- Sale starts once through `startSaleAt`.
- `buy` and WarBow CL8Y actions require sale live and `buyFeeRoutingEnabled`.
- `buy` enforces CHARM min/max bounds and per-wallet cooldown.
- Full gross accepted-asset amount routes through `FeeRouter`.
- `totalRaised` tracks gross buy spend under standard ERC20 assumptions.
- `totalCharmWeight` tracks base CHARM plus referral CHARM.
- `redeemCharms` is once per wallet, after end, gated by owner signoff.
- Last-buyer and WarBow podiums are deterministic by state updates.
- `distributePrizes` is owner-only and gated before CL8Y podium payouts.

Residual invariant concerns:

- `PodiumPool` balance can remain nonzero after `prizesDistributed` if a category has no winners.
- TimeCurve economics depend on `ICharmPrice` remaining trustworthy and unchanged except through intended governance.
- Referral CHARM increases total CHARM weight without additional reserve contribution, which is documented but dilutive and should remain visible in participant-facing calculations.

### RabbitTreasury

Reviewed invariants:

- Deposits increase redeemable backing and mint DOUB.
- Fee income increases protocol-owned backing and/or burn, with no DOUB mint.
- Withdrawals burn DOUB and draw only from redeemable backing.
- Protocol-owned backing is not extractable through ordinary user withdrawals.
- Epoch finalization updates `eWad` from total backing and supply.
- Pause blocks deposit/withdraw, not `receiveFee` or `finalizeEpoch`.

Residual invariant concerns:

- Reserve accounting equals actual token balance only for standard, non-rebasing reserve assets.
- Math-critical parameter mutation can break expected repricing behavior if roles are compromised or misconfigured.
- `withdraw` is not `nonReentrant`; it appears safe for standard ERC20 but should not be paired with malicious hook-like reserve assets.

### FeeRouter and Sinks

Reviewed invariants:

- Sink weights must sum to 10,000 bps.
- Last sink receives rounding remainder.
- Sinks cannot be zero addresses.
- Sink withdrawals require `WITHDRAWER_ROLE`.
- Podium payouts require `prizePusher` once set, otherwise legacy distributor role.

Residual invariant concerns:

- Permissionless distribution routes any token held by `FeeRouter`, not just CL8Y.
- Misconfigured sinks can revert and block fee distribution.

### Vesting

Reviewed invariants:

- Beneficiary list and allocations are immutable after initialization.
- Duplicate/zero beneficiaries and zero allocations revert.
- Sum must match required total.
- `startVesting` requires full funding and can run once.
- `claim` requires `claimsEnabled`, beneficiary status, and positive claimable amount.
- Claimed amount cannot exceed allocation.

No unprivileged asset extraction path was found.

### ReferralRegistry

Reviewed invariants:

- Codes normalize to lowercase alphanumeric, length 3-16.
- One code per owner.
- One owner per code hash.
- Registration burns CL8Y.

Residual concern: code registration is first-transaction-wins and front-runnable.

### LeprechaunNFT

Reviewed invariants:

- Series max supply enforced.
- Minting requires `MINTER_ROLE`.
- Traits are stored onchain at mint.
- Base URI is admin-mutable.

No direct fund-extraction issue found.

## Net-Asset Extraction Analysis

Under the intended assumptions, the main externally callable value-moving paths do not expose an unprivileged net-asset extraction:

- `TimeCurve.buy` pulls exactly computed accepted asset amount, then distributes through configured fee sinks. A failure in transfer or fee distribution reverts the whole buy.
- `TimeCurve.redeemCharms` pays launched tokens pro rata after sale end and once per address.
- `TimeCurve.distributePrizes` can under-distribute if categories are empty, but does not allow arbitrary attackers to redirect the pool to themselves.
- WarBow steal/revenge/guard burn accepted asset to the dead sink and mutate only battle points.
- `RabbitTreasury.deposit` and `withdraw` preserve redeemable/protocol bucket separation under standard ERC20 assumptions.
- `RabbitTreasury.receiveFee` is role-gated and does not mint DOUB.
- `DoubPresaleVesting.claim` is bounded by allocation and vested amount.
- `FeeSink.withdraw` is role-gated.
- `PodiumPool.payPodiumPayout` is limited to `prizePusher` after production wiring.

Potential extraction or misdirection scenarios are limited to:

- Privileged-role compromise or malicious upgrade.
- Later `TimeCurveBuyRouter` callers harvesting accidentally pre-seeded WETH/stable balances.
- Deploying with non-standard ERC20 reserve/accepted assets.
- FeeRouter distributing accidentally sent arbitrary tokens to configured sinks.

## Design-Level Risks After Deep Review

1. Admin risk dominates technical risk. The system's financial safety depends on operational custody of UUPS owners, AccessControl admins, token minter admins, fee governors, and parameter roles. Without enforced timelocks or multisigs, "audited code" can still be bypassed by an upgrade or parameter mutation.

2. Prize policy is underspecified for empty podium categories. Four fixed categories are documented, but the contract does not define how to handle category slices when no winner exists. This can strand reserve assets and create participant disputes.

3. Router dust policy is asymmetric. CL8Y dust is explicitly sent to protocol treasury, while input-token leftovers are refunded as whole router balances to the current caller. This should become delta-based accounting or an explicit stuck-funds policy.

4. The standard-ERC20 assumption is broad. The current code is clean for plain ERC20s, but many live tokens are upgradeable, fee-on-transfer, rebasing, pausable, blacklistable, or hook-enabled. Deployment should treat token choice as part of the security boundary.

5. RabbitTreasury economics are sensitive to privileged parameter choices. The math library is bounded, but setter-level bounds are incomplete. Incorrect values can make a healthy contract behave badly without any Solidity exploit.

6. TimeCurve game mechanics intentionally expose MEV surfaces. Last-buy, timer reset, WarBow, and referral registration are all order-sensitive. This is not a coding bug, but must remain explicit in UX and operations.

7. Upgradeable storage safety needs process controls. The contracts use gaps, but this audit did not compare deployed historical layouts. Every future upgrade should include automated storage-layout checks and proxy-address verification.

## Recommendations Summary

1. Add timelock/multisig enforcement or deployment-level hard requirements for all admin and upgrade roles.
2. Fix `TimeCurve.distributePrizes` empty-category behavior and test final pool balance after settlement.
3. Change `TimeCurveBuyRouter` refunds to use input-token balance deltas; add a governed rescue function for unrelated stuck tokens.
4. Add `block.timestamp >= saleStart` to `TimeCurveBuyRouter` phase checks.
5. Add bounded setters for all RabbitTreasury math-critical parameters.
6. Add zero-admin checks to AccessControl-based constructors/initializers.
7. Decide whether referral code front-running is acceptable; if not, implement commit-reveal.
8. Maintain a strict reserve/accepted-asset allowlist and reject non-standard token behavior operationally.
9. Run Slither and OpenZeppelin upgrade-storage checks before external audit and every production upgrade.

## Final Assessment

The contracts show strong use of OpenZeppelin primitives, SafeERC20, explicit tests, invariant tests, and clear documentation of many known assumptions. No critical unprivileged fund-drain path was identified in the reviewed source. The code is not yet ready to treat as trust-minimized mainnet infrastructure until the governance/upgrade model, empty-category prize settlement, router balance handling, and parameter-bound issues are resolved or explicitly accepted in launch signoff.

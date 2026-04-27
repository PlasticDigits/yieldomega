# CL8Y Flow Audit

**Scope.** This audit covers the paths where the CL8Y reserve asset enters, crosses, or leaves Yieldomega app smart contracts. It also notes frontend, indexer, and local-script surfaces that trigger or observe those contract paths.

**Policy lens.** CL8Y flowing **into** app contracts is generally low risk. CL8Y flowing **out of** app contracts is high risk and should be executed by an owner/admin-controlled caller, without a timelock, so a human can manually review and execute the movement when ready. This report treats deterministic public outflows as **policy exceptions to approve explicitly**, not as automatic passes.

Audited against `origin/main` after `2511077` (`docs(security): audit CL8Y flows through smart contracts`).

## Issue #70 follow-up (hardening merged)

The following audit gaps were **closed or narrowed** on `main` per [GitLab #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70) (see [`docs/testing/invariants-and-business-logic.md`](../testing/invariants-and-business-logic.md) and [`TimeCurve.sol`](../../contracts/src/TimeCurve.sol) / [`PodiumPool.sol`](../../contracts/src/sinks/PodiumPool.sol) / [`TimeCurveBuyRouter.sol`](../../contracts/src/TimeCurveBuyRouter.sol)):

- **`TimeCurve.distributePrizes`** is **`onlyOwner`** — execution requires the same multisig/operator wallet as upgrades, not only `reservePodiumPayoutsEnabled`.
- **`PodiumPool`:** production deploys call **`setPrizePusher(TimeCurve)`** once; **`payPodiumPayout`** then requires **`msg.sender == prizePusher`** (legacy **`DISTRIBUTOR_ROLE`** path remains when `prizePusher` is unset for tests/migration).
- **`TimeCurveBuyRouter`:** post-`buyFor` CL8Y on the router is transferred to **`cl8yProtocolTreasury`** (immutable constructor arg), not to the buyer — removes “sweep next caller” incentive.
- **WarBow CL8Y burns** remain **user-driven approved exceptions**; fuzz coverage documents **sink-exact** burn invariants: [`TimeCurveWarBowCl8yBurns.t.sol`](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol).
- **Rabbit Treasury** `withdraw` / `receiveFee` policy alignment is **deferred** (TODO in [`RabbitTreasury.sol`](../../contracts/src/RabbitTreasury.sol) NatSpec).

## Executive Findings

1. **Compliant admin-reviewed outflows exist but are narrow.** `FeeSink.withdraw` on `EcosystemTreasury`, `CL8YProtocolTreasury`, and `DoubLPIncentives` requires `WITHDRAWER_ROLE` and has no timelock. These are the clearest matches for the owner/admin manual-review requirement.
2. **Several CL8Y outflows are public or contract-called today.** `TimeCurve.buy` routes CL8Y to `FeeRouter`, `FeeRouter.distributeFees` fans out CL8Y to sinks, WarBow burns send CL8Y to the burn sink, `RabbitTreasury.withdraw` pays users, and (historically) `TimeCurve.distributePrizes` could be called by any address once the gate was on. Many paths are product-intended **exceptions** to a strict "outflow caller is owner/admin" rule — see **Issue #70 follow-up** above.
3. **(Historical — issue #70)** `TimeCurve.distributePrizes` was callable by any address once the reserve gate was on; it is now **`onlyOwner`**, with Arena UI owner-gated.
4. **(Historical — issue #70)** `TimeCurveBuyRouter` used to refund router CL8Y to `msg.sender`; surplus now routes to **`cl8yProtocolTreasury`**.
5. **No hidden rescue/sweep paths were found.** The production `contracts/src` CL8Y-relevant transfer sites are enumerable via `safeTransfer`, `safeTransferFrom`, `distributeFees`, `distributePrizes`, `withdraw`, and `receiveFee`. Local Anvil fixtures and mock CL8Y minting are out of production scope.

## CL8Y Inflows

These are lower risk under the requested model because the app contract receives CL8Y rather than releases it.

| ID | Contract path | Trigger | Notes |
|----|---------------|---------|-------|
| I1 | `TimeCurve._buy` | User `buy`, or `TimeCurveBuyRouter` through `buyFor` | Pulls `acceptedAsset` from the payer, then immediately routes it onward. |
| I2 | `TimeCurve.warbowSteal`, `warbowRevenge`, `warbowActivateGuard` | User WarBow action | Pulls a fixed CL8Y burn amount from the caller before burning. |
| I3 | `RabbitTreasury.deposit` | User deposit | Pulls reserve CL8Y and mints DOUB against redeemable backing. |
| I4 | `RabbitTreasury.receiveFee` | `FEE_ROUTER_ROLE` caller | Pulls CL8Y, burns a configured share, and books the rest as protocol-owned backing. Current fee routing sends directly to sinks, so deployments must confirm whether this path is used. |
| I5 | `ReferralRegistry.registerCode` | User registration | Transfers CL8Y directly from user to `BURN_ADDRESS`; the registry does not custody CL8Y. |
| I6 | `TimeCurveBuyRouter.buyViaKumbaya` | User ETH/stable entry | Kumbaya exact-output swap deposits gross CL8Y into the router before `buyFor`. |

## CL8Y Outflow Matrix

| ID | Outflow path | Caller today | Destination control | Policy status |
|----|--------------|--------------|---------------------|---------------|
| O1 | `TimeCurve._buy` sends CL8Y to `FeeRouter`, then calls `FeeRouter.distributeFees` | Public user via `buy`, or configured buy router via `buyFor` | `feeRouter` is set at initialize; sink table is governed by `GOVERNOR_ROLE` | **Exception/gap.** Execution is not owner/admin-called, though owner can disable buys with `setBuyFeeRoutingEnabled`. |
| O2 | `FeeRouter.distributeFees` sends CL8Y to five sinks | Public external function; normally called by `TimeCurve` | Sink destinations/weights are `GOVERNOR_ROLE` controlled and no timelock | **Exception/gap.** Public execution can also flush accidental router balances if present. |
| O3 | WarBow burn transfers from `TimeCurve` to `BURN_SINK` | Public user action | Hardcoded burn address | **Exception to approve.** Caller funds the burn in the same transaction, but the outflow is not admin-called. |
| O4 | `TimeCurve.distributePrizes` causes `PodiumPool.payPodiumPayout` | **`onlyOwner`** after `reservePodiumPayoutsEnabled` when `prizePool > 0` (issue #70) | Winners are derived from onchain sale state; `PodiumPool` uses **`prizePusher`** (TimeCurve) when set | **Addressed (issue #70).** Execution is owner-only; pool pushes are wired to the canonical TimeCurve address. |
| O5 | `PodiumPool.payPodiumPayout` transfers CL8Y to winners | **`TimeCurve`** when configured as **`prizePusher`** (or legacy `DISTRIBUTOR_ROLE` if unset) | Winner and amount supplied by `TimeCurve.distributePrizes` | **Addressed (issue #70)** for production wiring; legacy role path documented for tests. |
| O6 | `FeeSink.withdraw` on `EcosystemTreasury`, `CL8YProtocolTreasury`, `DoubLPIncentives` | `WITHDRAWER_ROLE` | Admin supplies token, recipient, amount | **Pass.** Owner/admin-style role, no timelock, manual review possible. |
| O7 | `RabbitTreasury.withdraw` sends CL8Y to a DOUB redeemer | Public user | Payout is math-bounded by redeemable backing, efficiency, cooldown, and fee | **Product exception/gap.** If user redemptions are intended to stay public, document the exception explicitly. |
| O8 | `RabbitTreasury.receiveFee` burn leg sends CL8Y to `burnSink` | `FEE_ROUTER_ROLE` caller | Burn sink is set at initialize and has no setter | **Exception to approve.** Role-gated but not owner/admin manual execution. |
| O9 | `TimeCurveBuyRouter.buyViaKumbaya` CL8Y remainder after `buyFor` | Public user | **`cl8yProtocolTreasury`** (immutable constructor sink) | **Addressed (issue #70).** Surplus is protocol treasury, not buyer refund; see `Cl8ySurplusToProtocol`. |
| O10 | UUPS upgrades on CL8Y-path contracts | `onlyOwner` / `DEFAULT_ADMIN_ROLE` | New implementation can change future flow behavior | **Pass with operational risk.** No timelock; must be monitored and multisig-controlled. |

## App And Observability Surfaces

- `frontend/src/pages/timecurve/useTimeCurveSaleSession.ts` and `frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx` initiate buys, Kumbaya entry, and WarBow burns.
- `frontend/src/pages/timeCurveArena/TimeCurveArenaView.tsx` — **`distributePrizes`** CTA is **owner-only** (matches onchain `onlyOwner`; non-owner sees disabled control + copy).
- `frontend/src/pages/referrals/ReferralRegisterSection.tsx` initiates referral registration burns. This is a direct user-to-burn transfer, not app-custodied CL8Y.
- The indexer decodes and persists `BuyViaKumbaya`, `WarBowCl8yBurned`, `PodiumPaid`, `BurrowDeposited`, `BurrowWithdrawn`, and `FeesDistributed`. It is observability only and cannot authorize CL8Y movement.
- Local Anvil fixtures (`AnvilKumbayaFixture`, mock CL8Y minting, rich-state scripts) deliberately bypass production constraints and should remain excluded from production deployments.

## Recommendations

1. **Decide and document the approved exception set.** If public user redemptions, user-funded burns, and buy-time fee routing are intentional exceptions to "owner/admin executes every CL8Y outflow", state that in `docs/operations/final-signoff-and-value-movement.md`, `docs/onchain/fee-routing-and-governance.md`, and the invariant map.
2. **Make `TimeCurve.distributePrizes` owner/admin-only, or add an explicit operator role.** The current owner enable flag is useful, but it does not make the payout execution itself a manually reviewed admin transaction.
3. **Harden `TimeCurveBuyRouter` CL8Y refunds.** Refund only same-transaction surplus (`postSwapBalance - preSwapBalance - grossCl8y`) or revert when pre-existing CL8Y is detected, so accidental CL8Y cannot be swept by the next buyer.
4. **Constrain or document `FeeRouter.distributeFees`.** If strict manual execution is desired, gate it. If immediate buy-time routing is desired, document it as an exception and alert on direct/manual calls and unexpected router balances.
5. **Confirm sink and upgrade admin custody.** Production `WITHDRAWER_ROLE`, `GOVERNOR_ROLE`, `DEFAULT_ADMIN_ROLE`, and `TimeCurve` owner should be hardware-backed/multisig-controlled and explicitly **not timelocked** for final signoff/value movement.
6. **Add monitoring for high-impact events.** Alert on `Withdrawn(token == CL8Y)`, `SinksUpdated`, `ReservePodiumPayoutsEnabled`, `BuyFeeRoutingEnabled`, and `Upgraded` on every UUPS proxy in the CL8Y path.
7. **Add a deploy-time guard against mock CL8Y.** Non-Anvil deployments should fail if `acceptedAsset` or `reserveAsset` resolves to `MockCL8Y` / `MockReserveCl8y`.

## Bottom Line

The codebase has a small and auditable CL8Y transfer surface, and the truly discretionary treasury withdrawals already use owner/admin-style roles without timelocks. **Issue #70** tightened **podium execution** and **Kumbaya router CL8Y surplus** routing; **WarBow** burns remain an **explicit approved exception** (user-funded, sink-exact); **Rabbit Treasury** public redemption / fee paths remain documented **exceptions / TODO** until product follow-up.

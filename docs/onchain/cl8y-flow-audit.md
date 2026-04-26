# CL8Y flow audit (smart contracts)

**Scope.** Every code path that moves the **CL8Y reserve asset** into or out of a Yieldomega smart contract. CL8Y is the canonical reserve / accepted asset; in dev / Anvil it is the `MockReserveCl8y` mint, in production it is the real CL8Y ERC-20.

**Threat model.** Per the maintainer's guidance:

- **Inflows** (CL8Y entering a contract under user pull-payment, swaps, or sale routing) are **low risk**: contracts are not at risk from receiving more CL8Y than expected.
- **Outflows** (CL8Y leaving a contract to an EOA / external address) are **high risk** and **must be**:
  1. Either fully **deterministic** (no admin discretion — burn sink, sale-router refund, on-rails routing), **or**
  2. **Gated by an owner / admin role with no timelock**, so a human can run a manual review immediately and pull the trigger when ready.

The **"no timelock"** part is intentional: in this design, value movement requires **affirmative manual review**, not delayed-but-automatic execution. The audit below classifies each CL8Y outflow against this rule.

Code references in this report are pinned to `origin/main` at commit `5eaf345`.

## Contracts considered

| Contract | Holds CL8Y? | Has CL8Y outflow? |
|----------|-------------|-------------------|
| `TimeCurve` (`contracts/src/TimeCurve.sol`) | Yes — buys + WarBow burns transit through here | Yes — to `FeeRouter` (deterministic), `BURN_SINK` (deterministic), and indirectly to `PodiumPool` |
| `FeeRouter` (`contracts/src/FeeRouter.sol`) | Transient (one tx) | Yes — fan-out to 5 sinks (deterministic, weight-driven) |
| `PodiumPool` (`contracts/src/sinks/PodiumPool.sol`) | Yes — accumulates podium slice | Yes — `payPodiumPayout`, role-gated to TimeCurve |
| `EcosystemTreasury` (`contracts/src/sinks/EcosystemTreasury.sol`) | Yes (when configured as a sink) | Yes — `FeeSink.withdraw`, role-gated, **owner/admin, no timelock** |
| `CL8YProtocolTreasury` (`contracts/src/sinks/CL8YProtocolTreasury.sol`) | Yes (legacy / optional sink) | Yes — `FeeSink.withdraw`, role-gated, **owner/admin, no timelock** |
| `DoubLPIncentives` (`contracts/src/sinks/DoubLPIncentives.sol`) | Yes (locked-LP staging) | Yes — `FeeSink.withdraw`, role-gated, **owner/admin, no timelock** |
| `RabbitTreasury` (`contracts/src/RabbitTreasury.sol`) | Yes — Burrow reserve backing | Yes — user `withdraw` (deterministic, math-bounded) and burn-sink leg (deterministic) |
| `TimeCurveBuyRouter` (`contracts/src/TimeCurveBuyRouter.sol`) | Transient (one tx) | Yes — refund of leftover CL8Y dust to `msg.sender` (deterministic) |
| `ReferralRegistry` (`contracts/src/ReferralRegistry.sol`) | No — burns directly to `dEaD` from caller | None — no contract-held CL8Y |
| `LeprechaunNFT` | No | No |
| `DoubPresaleVesting` | No (handles DOUB only) | No |
| `Doubloon` | No | No |
| `MockCL8Y` / `MockReserveCl8y` | N/A (dev only) | Open `mint` (dev only) |
| `AnvilKumbayaFixture` | Local-only swap fixture | Open swap path (test fixture only — not deployed in production) |

## Inflows (low-risk — listed for completeness)

All of these are pull-style `safeTransferFrom(payer, …)` and are bounded by either user signature or a role check upstream.

| # | Where | Inflow | Caller | Bound |
|---|-------|--------|--------|-------|
| I1 | `TimeCurve._buy` (`TimeCurve.sol:369`) | `acceptedAsset.safeTransferFrom(payer, address(this), amount)` | `buy` (`msg.sender`) or `buyFor` (router only) | `amount = charmWad * priceWad / WAD`, charm bounds + cooldown enforced |
| I2 | `TimeCurve.warbowSteal` (`TimeCurve.sol:509,514`) | `safeTransferFrom(msg.sender, this, WARBOW_STEAL_BURN_WAD [+ BYPASS])` | Sale participant | Constants (1 / 50 CL8Y) |
| I3 | `TimeCurve.warbowRevenge` (`TimeCurve.sol:560`) | `safeTransferFrom(msg.sender, this, WARBOW_REVENGE_BURN_WAD)` | Avenger | Constant (1 CL8Y) |
| I4 | `TimeCurve.warbowActivateGuard` (`TimeCurve.sol:581`) | `safeTransferFrom(msg.sender, this, WARBOW_GUARD_BURN_WAD)` | Player | Constant (10 CL8Y) |
| I5 | `RabbitTreasury.deposit` (`RabbitTreasury.sol:350`) | `reserveAsset.safeTransferFrom(msg.sender, this, amount)` | User | User-supplied amount |
| I6 | `RabbitTreasury.receiveFee` (`RabbitTreasury.sol:404`) | `reserveAsset.safeTransferFrom(msg.sender, this, amount)` | `FEE_ROUTER_ROLE` only | Caller is the trusted FeeRouter |
| I7 | `ReferralRegistry.registerCode` (`ReferralRegistry.sol:64`) | `cl8yToken.safeTransferFrom(msg.sender, BURN_ADDRESS, registrationBurnAmount)` | User | Constant; goes **straight to `dEaD`** — never held |
| I8 | `TimeCurveBuyRouter.buyViaKumbaya` (`TimeCurveBuyRouter.sol:103`) | Kumbaya swap deposits CL8Y to router | `msg.sender` (with ETH or stable approval) | Bounded by `amountOut = grossCl8y` (exact-output) |

There are no other CL8Y inflow surfaces.

## Outflows (high-risk — every one classified)

### Deterministic, on-rails outflows (no admin discretion)

These never sit at admin discretion — the recipient is hard-coded by code or computed from on-chain state at the time of the call. They are **not** owner-gated because they don't need to be: a malicious admin cannot redirect them, and a benign admin cannot delay them.

| # | Where | Outflow | Recipient | Why it is OK |
|---|-------|---------|-----------|--------------|
| O1 | `TimeCurve._buy` (`TimeCurve.sol:386`) → `feeRouter.distributeFees(...)` | `safeTransfer(feeRouter, amount)` then router fans out per `sinks[]` | Hard-coded `feeRouter` address (immutable in storage post-init) | Routing weights **and** sink set are governed by `GOVERNOR_ROLE` on `FeeRouter` (see O7); the per-tx call is deterministic given the current sink table |
| O2 | `TimeCurve.warbowSteal` (`TimeCurve.sol:521`) | `safeTransfer(BURN_SINK, totalBurn)` | `0x…dEaD` constant | Hardcoded burn |
| O3 | `TimeCurve.warbowRevenge` (`TimeCurve.sol:562`) | `safeTransfer(BURN_SINK, WARBOW_REVENGE_BURN_WAD)` | `0x…dEaD` | Hardcoded burn |
| O4 | `TimeCurve.warbowActivateGuard` (`TimeCurve.sol:583`) | `safeTransfer(BURN_SINK, WARBOW_GUARD_BURN_WAD)` | `0x…dEaD` | Hardcoded burn |
| O5 | `TimeCurve.distributePrizes` (`TimeCurve.sol:660–683`) → `PodiumPool.payPodiumPayout` (`PodiumPool.sol:33–43`) | `safeTransfer(winner, amount)` | Top-3 winners selected by on-chain leaderboard storage (`_podiums`, `_warbowPodium`) | Recipients are computed from sale state during the sale and frozen at `endSale`; **and** the call is **gated by `reservePodiumPayoutsEnabled`** (`onlyOwner` setter, no timelock — see G1). `DISTRIBUTOR_ROLE` granted only to `TimeCurve` in `DeployDev.s.sol:134` |
| O7 | `FeeRouter.distributeFees` (`FeeRouter.sol:60–75`) | 5 × `safeTransfer(sink_i, share_i)` | `sinks[i].destination` | Pure function of `sinks` table + amount; permissionless to call but only meaningful when caller (TimeCurve) has just deposited. Sink table mutated by `updateSinks` (`GOVERNOR_ROLE`, no timelock — see G2) |
| O8 | `RabbitTreasury.withdraw` (`RabbitTreasury.sol:385`) | `safeTransfer(msg.sender, userOut)` | `msg.sender` (DOUB burner) | Amount is `min(nominal, proRata) * efficiency * (1 - withdrawFee)`, math-bounded by `_previewWithdraw`; recipient = caller |
| O9 | `RabbitTreasury.receiveFee` burn leg (`RabbitTreasury.sol:414`) | `safeTransfer(burnSink, burned)` | `burnSink` (default `0x…dEaD`; configurable at `initialize` only — no setter) | Hardcoded at deploy; `burnSink` has **no setter** in the contract |
| O10 | `TimeCurveBuyRouter.buyViaKumbaya` dust refund (`TimeCurveBuyRouter.sol:138`) | `safeTransfer(msg.sender, dust)` | `msg.sender` of the same call | Recipient = caller; amount = leftover CL8Y after `tc.buyFor` consumes exactly `grossCl8y` |

### Outflows gated by an owner/admin role (no timelock)

These are the **discretionary** outflows. They sit in this category exactly because the design requires a human signoff. Each one is reachable only through a role-checked function whose role is granted to the deployer/admin in `DeployDev.s.sol`, and **none of these contracts implement a timelock**.

| # | Where | Outflow | Role required | Setter is `onlyRole` w/o timelock? |
|---|-------|---------|---------------|-------------------------------------|
| G1 | `TimeCurve.distributePrizes` (`TimeCurve.sol:668`) | Indirectly drives O5 (CL8Y reserve → podium winners) | Effectively **`onlyOwner`**, via `setReservePodiumPayoutsEnabled(bool)` (`TimeCurve.sol:290–293`) — `distributePrizes` reverts when `prizePool > 0` and the flag is false. Default is `false` after `initialize` (`TimeCurve.sol:262`) | **Yes** — `onlyOwner`, immediate. `Ownable` (no `OwnableTimelocked`) — confirmed by reading `OwnableUpgradeable` in inheritance |
| G2 | `FeeRouter.updateSinks` (`FeeRouter.sol:78–96`) | Changes the destination for every future on-rails CL8Y routing (O1, O7) | `GOVERNOR_ROLE` | **Yes** — `onlyRole(GOVERNOR_ROLE)`, immediate, granted to `admin` in `initialize` (`FeeRouter.sol:52`) |
| G3 | `FeeSink.withdraw` (`FeeSink.sol:34–38`) — implemented by **`EcosystemTreasury`**, **`CL8YProtocolTreasury`**, **`DoubLPIncentives`** | `safeTransfer(to, amount)` of *any held token* — including CL8Y received as a sink share | `WITHDRAWER_ROLE` (granted to `admin` at `__FeeSink_init`, `FeeSink.sol:28`) | **Yes** — `onlyRole(WITHDRAWER_ROLE)`, immediate. Recipient `to` is supplied by the admin call (`require(to != address(0))`); amount is supplied. **This is the primary discretionary CL8Y outflow path in the app.** |
| G4 | UUPS upgrade authorization on each contract | An upgrade can replace any of the above implementations and effectively redirect CL8Y | `_authorizeUpgrade`: `onlyOwner` on `TimeCurve` / `ReferralRegistry`; `onlyRole(DEFAULT_ADMIN_ROLE)` on `FeeRouter`, `PodiumPool`, `FeeSink` (and its three concrete subclasses), `RabbitTreasury` | **Yes** — immediate, `onlyOwner` / `onlyRole(DEFAULT_ADMIN_ROLE)`. **No timelock.** |

`PodiumPool.payPodiumPayout` is **not** in G — it is `onlyRole(DISTRIBUTOR_ROLE)`, which is granted exclusively to `TimeCurve` in `DeployDev.s.sol:134`. The discretion lives upstream in G1 (`reservePodiumPayoutsEnabled`).

### Other operational gates that affect CL8Y flow

These do not directly move CL8Y but switch CL8Y-moving paths on/off; they live in the same category as G and are listed for completeness:

| Gate | Function | Default | Effect |
|------|----------|---------|--------|
| `setBuyFeeRoutingEnabled(bool)` (`TimeCurve.sol:280–283`) | `onlyOwner` | `true` | When `false`, blocks `buy`, `warbowSteal`, `warbowRevenge`, `warbowActivateGuard` (i.e. all CL8Y-pulling sale paths). `claimWarBowFlag` is unaffected (no CL8Y movement) |
| `setCharmRedemptionEnabled(bool)` (`TimeCurve.sol:285–288`) | `onlyOwner` | `false` | When `false`, blocks `redeemCharms` — note: `redeemCharms` moves the **launched token**, not CL8Y, so this gate is out of scope for CL8Y flow but documented here |
| `setTimeCurveBuyRouter(address)` (`TimeCurve.sol:296–299`) | `onlyOwner` | `address(0)` | When non-zero, allows the router contract to call `buyFor` (which pulls CL8Y from the router). Setting back to `0` cleanly disables that entry |

## Findings

### F1 — All discretionary CL8Y outflows are correctly admin-gated without a timelock (PASS)

Every CL8Y outflow that is **not** deterministic on-rails routing or burn-sink lands on either `FeeSink.withdraw` (`WITHDRAWER_ROLE`) or `TimeCurve.setReservePodiumPayoutsEnabled` (`onlyOwner`). Both are immediate role-gated calls — the maintainer can perform manual review and execute in one tx, with no timelock delay. This matches the stated design intent.

### F2 — `FeeRouter.updateSinks` is the highest-impact discretionary control (PASS, but worth a deployment note)

`FeeRouter.updateSinks` doesn't move CL8Y itself but **redirects every future TimeCurve buy** (and all future fee-routing flows) into a new sink set. This is by design (`GOVERNOR_ROLE`, no timelock — same human-in-the-loop pattern as the rest), and the existing event `SinksUpdated` emits both old and new tuples for monitoring. **Recommendation**: ensure operational runbook explicitly lists `SinksUpdated` as a high-severity alert in monitoring (separate from generic admin events).

### F3 — `FeeSink.withdraw` accepts arbitrary `(token, to, amount)` — by design, but consider explicit logging conventions (INFO)

`withdraw` lets the WITHDRAWER pull any ERC-20 (not only the asset the sink was conceptually built for) to any non-zero address, in any amount. This is consistent with the "manual review" model — the operator decides — and the `Withdrawn` event includes `token`, `to`, `amount`, and `actor`. **Recommendation**: keep the per-sink monitoring rule "any `Withdrawn(token == CL8Y, ...)` event from `EcosystemTreasury`/`DoubLPIncentives`/`CL8YProtocolTreasury` is a high-severity alert", and consider documenting expected destinations (e.g. multisig, LP locker contract) in `docs/onchain/treasury-contracts.md` to make off-spec withdrawals obvious in review.

### F4 — `RabbitTreasury.burnSink` has no setter (PASS)

`burnSink` is set once in `initialize` and has no `setBurnSink` function. After deployment to `DEFAULT_BURN_SINK = 0x…dEaD`, the burn leg of `receiveFee` cannot be redirected by an admin. This is the correct posture for an irreversible-burn invariant.

### F5 — `TimeCurveBuyRouter` is fully deterministic and holds no balance between calls (PASS)

The router pulls CL8Y from Kumbaya, immediately approves it to `TimeCurve`, calls `buyFor`, then refunds any dust to `msg.sender`. There is no admin-controlled outflow function and no `withdraw` / `sweep`. If the swap underdelivers (`cl8yGain < grossCl8y`), the call reverts before any further action. The only outflow is the dust refund **to the same caller**. ✅

### F6 — `MockReserveCl8y` / `MockCL8Y` have open `mint` (DEV ONLY — INFO)

`MockReserveCl8y.mint` and `MockCL8Y.mint` accept any `(to, amount)` from any caller. This is intentional for Anvil drills and is comment-tagged "NOT for production". **Recommendation**: ensure the production reserve asset wiring (`RESERVE_ASSET_ADDRESS` env in `DeployDev.s.sol`) is verified during the production deploy checklist so that the mock is never bound to a real `TimeCurve.acceptedAsset`. The deployment checklist `docs/operations/deployment-checklist.md` already enforces this, but tying a check to "no `MockReserveCl8y` at the configured CL8Y address" in the deploy script verifier would tighten it.

### F7 — UUPS upgrade authorization is the ultimate CL8Y outflow control (PASS, but operationally significant)

Every UUPS-upgradeable contract on the CL8Y path (`TimeCurve`, `FeeRouter`, `PodiumPool`, all `FeeSink` subclasses, `RabbitTreasury`, `ReferralRegistry`) is upgrade-authorized by `onlyOwner` or `onlyRole(DEFAULT_ADMIN_ROLE)` with **no timelock**. An attacker (or a compromised admin key) holding that role can replace any of these implementations in a single transaction and arbitrarily redirect CL8Y on the next call. This is consistent with the design statement "owner/admin without timelock so it can be done via manual review", but it amplifies the importance of:

- Multisig (or hardware-backed) custody of the admin key.
- A monitoring/alerting rule on `Upgraded(implementation)` events on every UUPS proxy listed in `docs/onchain/treasury-contracts.md`.
- A renounce / migrate-to-multisig step in the post-launch ops runbook (see `docs/operations/final-signoff-and-value-movement.md`).

**Recommendation**: cross-link this audit from `docs/onchain/security-and-threat-model.md` and add a row to the monitoring table for `Upgraded` events on each proxy.

### F8 — There is no CL8Y outflow surface accessible to non-admin EOAs other than the deterministic ones (PASS)

A grep for `safeTransfer(` / `.transfer(` against `contracts/src` (excluding the test fixtures) yields exactly the 11 sites enumerated above. There is no `rescue`, `sweep`, or generic `recoverERC20` function on any production contract. This is a deliberately tight surface and matches the spec.

## Summary table

| Category | Count | Notes |
|----------|-------|-------|
| Deterministic on-rails CL8Y outflows | 9 (O1–O5, O7–O10) | All recipient-bound by code or on-chain state |
| Discretionary CL8Y outflows | 1 family — `FeeSink.withdraw` (3 deployments) + 1 control (`reservePodiumPayoutsEnabled`) | All `onlyOwner` / `onlyRole(...)`, **no timelock**, immediate manual review possible — meets the stated requirement |
| Upgrade-authorized contracts on the CL8Y path | 8 | All `onlyOwner` / `onlyRole(DEFAULT_ADMIN_ROLE)`, no timelock |
| Hidden CL8Y outflow paths found | **0** | No `selfdestruct`, no `rescueERC20`, no `sweep`, no fallback-driven send |

## Recommendations (in priority order)

1. **Document expected `withdraw` destinations** for `EcosystemTreasury`, `DoubLPIncentives`, and `CL8YProtocolTreasury` in `docs/onchain/treasury-contracts.md` (e.g. multisig address, LP locker address) so that an off-spec destination in a `Withdrawn` event is immediately obvious in monitoring.
2. **Add an alerting row for `Upgraded(implementation)`** to every UUPS proxy listed in `docs/onchain/security-and-threat-model.md`. Same for `FeeRouter.SinksUpdated` and `TimeCurve.ReservePodiumPayoutsEnabled` / `BuyFeeRoutingEnabled` events.
3. **Add a deploy-time guard** that the configured CL8Y address is **not** a `MockReserveCl8y` / `MockCL8Y` when broadcasting to a non-Anvil RPC. Cheap to do via a `vm.envString("NETWORK")` check or a chain-id whitelist in `DeployDev.s.sol`.
4. **Cross-link this audit** from:
   - `docs/onchain/security-and-threat-model.md`
   - `docs/onchain/fee-routing-and-governance.md`
   - `docs/operations/final-signoff-and-value-movement.md`
5. **Operational**: confirm the `WITHDRAWER_ROLE` and `DEFAULT_ADMIN_ROLE` for all sinks are held by a multisig in production (mainnet checklist). The contract design assumes this — call it out explicitly in `docs/operations/deployment-checklist.md`.

## Conclusion

The codebase implements the stated invariant correctly: **every CL8Y outflow is either deterministic and recipient-bound, or gated by an immediate `onlyOwner` / `onlyRole(...)` check with no timelock**. There are no hidden outflow surfaces, no `rescue`/`sweep` functions, and no admin-controlled `setBurnSink` that would let an admin redirect a hardcoded burn. The discretionary surface is concentrated in three places — `FeeSink.withdraw` on the three CL8Y-receiving sinks, `TimeCurve.setReservePodiumPayoutsEnabled`, and UUPS upgrade authorization — and all are appropriate seats for the manual-review model the design calls for.

The recommendations above are operational hardening (monitoring conventions, deploy guards, doc cross-links), not protocol changes.

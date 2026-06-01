# Final signoff and value movement (issue #55)

> **Superseded for Arena v2:** TimeCurve `endSale` / `redeemCharms` / `distributePrizes`, presale vesting **`/vesting`**, and CL8Y linear sale gates were removed ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)). Arena v2 uses **`TimeArena.paused`** only — see [`arena-v2.md`](../product/arena-v2.md) and **`INV-TIME-ARENA-ALWAYS-LIVE`** in [invariants](invariants-and-business-logic.md#timearena-v2-gitlab-260). The tables below document **retired v1** gates for historical ops reference.

This document records the **authoritative onchain gates** for [GitLab #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55): pausing or holding user-facing value movement (DOUB claims, sale allocation redemptions, reserve podium CL8Y) until a **governance/operator** step enables them.

**Authoritative state lives in contracts**; the indexer and frontend only reflect it.

## Gated operations (v1)

| System | User-facing action | Onchain control | Default after `initialize` |
|--------|----------------------|-----------------|-----------------------------|
| **DOUB presale vesting** | `claim()` | `setClaimsEnabled(bool)` (`onlyOwner`) | `claimsEnabled == false` |
| **DOUB presale vesting** | — (ops / treasury) | `rescueERC20(token, to, amount)` (`onlyOwner`) — **excess** vesting DOUB and stray non-vesting ERC20 only ([GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137); invariants §137) | n/a |
| **DOUB presale vesting** | — (ops / cap correction) | `reduceAllocationsUniformBps` / `burnDoubExcessAboveOutstanding` (`onlyOwner`) — uniform row shrink (floor) then **burn** DOUB above outstanding claim reserve; **token** must be **`ERC20Burnable`** (canonical **Doubloon**); reverts if any row would fall below `claimedOf` | n/a |
| **TimeCurve** | `buy` and WarBow **CL8Y** spend (`warbowSteal`, `warbowRevenge`, `warbowActivateGuard`) → `FeeRouter` | `setBuyFeeRoutingEnabled(bool)` (same storage flag) | `true` (live sale) |
| **TimeCurve** | `redeemCharms()` (DOUB sale allocation) | `setCharmRedemptionEnabled(bool)` | `false` |
| **TimeCurve** | `sweepUnredeemedLaunchedToken()` — remainder of **`launchedToken`** after **7-day** grace from **`saleEndedAt`** ([GitLab #128](https://gitlab.com/PlasticDigits/yieldomega/-/issues/128)) | **`setUnredeemedLaunchedTokenRecipient(address)`** (sink for sweep) + **`onlyOwner`** `sweep…` timing (not gated by `charmRedemptionEnabled`) | `unredeemedLaunchedTokenRecipient` unset until owner sets; no sweep until grace elapses |
| **TimeCurve** | `distributePrizes()` — **CL8Y reserve** from `PodiumPool` → podium winners when pool **non-zero** (**`onlyOwner` execution** + `setReservePodiumPayoutsEnabled`; [issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70)) **or** explicit **zero-pool** settlement ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)) | `setReservePodiumPayoutsEnabled(bool)` | `false` when CL8Y podium settlement would move funds |

<a id="doub-presale-vesting"></a>

**`distributePrizes` empty pool ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)):** if `PodiumPool` balance is zero, the function still requires **`reservePodiumPayoutsEnabled`**, emits **`PrizesSettledEmptyPodiumPool`**, and sets **`prizesDistributed`** (no **`PrizesDistributed`** event). Ops cannot refill and run **`distributePrizes`** again.

**`claimWarBowFlag`:** does **not** spend DOUB — **not** gated by **`TimeArena.paused`** (only BP / silence rules apply; see [#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)).

## Suggested go-live order (example)

1. Complete testing and deploy **with gates in safe defaults** (`charmRedemptionEnabled` and `reservePodiumPayoutsEnabled` off; presale `claimsEnabled` off).
2. **Presale:** fund vesting, `startVesting` if the schedule should run. If final allocations sit below the funded bucket, **`reduceAllocationsUniformBps` → `burnDoubExcessAboveOutstanding`** (owner). When legal/ops are ready for DOUB claims, **`setClaimsEnabled(true)`**.
3. **TimeCurve (post timer):** `endSale()` as today; then **`setCharmRedemptionEnabled(true)`** for DOUB sale allocation to buyers and/or **`setReservePodiumPayoutsEnabled(true)`** for **CL8Y reserve** podium payouts — order may differ by checklist (redeem vs CL8Y allocation are separate signoffs).
4. **Emergency halt of live sale:** `setBuyFeeRoutingEnabled(false)` stops **`buy` → `FeeRouter`** and **WarBow CL8Y spend** (`steal` / `revenge` / `guard`) in one switch (`TimeCurve: sale interactions disabled`). Flag claims (`claimWarBowFlag`) are unchanged.

## Upgrade notes (UUPS)

New storage is **appended** before `__gap` in `TimeCurve` and `DoubPresaleVesting`. After upgrading an existing proxy, uninitialized booleans are **false**; explicitly set the flags and document the migration (or use a reinitializer in a future change if a batch migration is required).

<a id="timecurve-warbow-feerouter-upgrade-2026-05-19"></a>

### TimeCurve — WarBow CL8Y → FeeRouter (2026-05-19)

**Deploy checklist:** upgrade the **`TimeCurve`** implementation (UUPS) so **`warbowSteal` / `warbowRevenge` / `warbowActivateGuard`** route gross CL8Y through **`FeeRouter`** (canonical buy split) and increment **`totalRaised`**, matching **`buy`**. **`claimWarBowFlag`** is unchanged (no CL8Y leg).

**Recorded (MegaETH mainnet, 2026-05-26):**

| Field | Value |
|-------|--------|
| **Upgrade tx hash** | [`0x53ac33e67ac5b26e7c0daf27abf12a70175b6d3ede4985b7deae06e76b43128e`](https://mega.etherscan.io/tx/0x53ac33e67ac5b26e7c0daf27abf12a70175b6d3ede4985b7deae06e76b43128e) |
| **Upgrade block number** | **16409300** (2026-05-26 04:25:11 UTC) — **before** = legacy 100% to burn sink; **at/after** = FeeRouter split |
| **New implementation** | [`0xd5c984E59C1482d63629532e8b1ebffaBf47029F`](https://mega.etherscan.io/address/0xd5c984E59C1482d63629532e8b1ebffaBf47029F#code) |
| **Proxy address** | `0x1B68bb6789baEBa4bD28F53C10b52DBe1eF2bF71` (unchanged) |
| **Impl deploy tx** | [`0x82f8bbc04f5e4622868c6052751862d71b9e9cb1920973965e79c1b7b9513f0f`](https://mega.etherscan.io/tx/0x82f8bbc04f5e4622868c6052751862d71b9e9cb1920973965e79c1b7b9513f0f) (block **16409248**) |

**`WarBowCl8yBurned` / indexer `cl8y_burned`:** names are **historical** — **`amountWad`** / **`amount_wad`** is **nominal spend**, not burn-sink receipt. No Postgres migration. See [primitives — historical event](../product/primitives.md#historical-warbowcl8yburned-event-name-2026-05-19-upgrade) · [indexer design](../indexer/design.md#warbow-cl8y-burned-historical-name).

## Post-end gate live walkthrough (issues #55 / [GitLab #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79))

Forge tests cover the revert strings; issue #79 tracks a **one-chain** `cast` walkthrough: `redeemCharms` with `charmRedemptionEnabled == false`, then owner enables + success; `distributePrizes` with `reservePodiumPayoutsEnabled == false` and **non-zero** podium pool, then owner enables + success (the **zero-pool** explicit settlement path is in Forge — [GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)).

- **Setup:** `ANVIL_RICH_END_SALE_ONLY=1` with [`contracts/script/anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh) runs `SimulateAnvilRichStatePart1` → warp past `deadline` → `SimulateAnvilRichStatePart2EndSaleOnly` (resets [DeployDev](../../contracts/script/DeployDev.s.sol)’s post-end flags to `false`, then `endSale()`). The default **full** rich script runs Part2, which flips those flags on and pays out — that path **cannot** re-run the “gate off” reverts on the same state.
- **Verify:** [`scripts/verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) (also indexed under invariants — issue #79 and [contributor manual QA — post-end gates](../testing/manual-qa-checklists.md#manual-qa-issue-79)).

**Manual fallback** (if the script fails): ensure `TimeCurve.ended() == true`, `charmRedemptionEnabled == false`, `reservePodiumPayoutsEnabled == false`, `prizesDistributed == false`, and non-zero `acceptedAsset` balance of `podiumPool` for the **non-zero distribution** script rows (empty-pool settlement — **#133** — uses the same **`reservePodiumPayoutsEnabled`** gate but different event semantics; see Forge).

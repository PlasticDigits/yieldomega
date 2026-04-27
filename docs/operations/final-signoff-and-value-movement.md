# Final signoff and value movement (issue #55)

This document records the **authoritative onchain gates** for [GitLab #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55): pausing or holding user-facing value movement (DOUB claims, sale allocation redemptions, reserve podium CL8Y) until a **governance/operator** step enables them.

**Authoritative state lives in contracts**; the indexer and frontend only reflect it.

## Gated operations (v1)

| System | User-facing action | Onchain control | Default after `initialize` |
|--------|----------------------|-----------------|-----------------------------|
| **DOUB presale vesting** | `claim()` | `setClaimsEnabled(bool)` (`onlyOwner`) | `claimsEnabled == false` |
| **TimeCurve** | `buy` → CL8Y → `FeeRouter`; WarBow **CL8Y** burns: `warbowSteal`, `warbowRevenge`, `warbowActivateGuard` | `setBuyFeeRoutingEnabled(bool)` (same storage flag) | `true` (live sale) |
| **TimeCurve** | `redeemCharms()` (DOUB sale allocation) | `setCharmRedemptionEnabled(bool)` | `false` |
| **TimeCurve** | `distributePrizes()` — **CL8Y reserve** from `PodiumPool` → podium winners (**`onlyOwner` execution** + `setReservePodiumPayoutsEnabled`; [issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70)) | `setReservePodiumPayoutsEnabled(bool)` | `false` when prize pool would be paid |

**`distributePrizes` empty pool:** if `PodiumPool` balance is zero, the function returns without setting `prizesDistributed` (unchanged griefing / retry behavior). The reserve-payout gate applies only when `prizePool > 0`.

**`claimWarBowFlag`:** does **not** spend CL8Y — **not** gated by `buyFeeRoutingEnabled` (only BP / silence rules apply).

## Suggested go-live order (example)

1. Complete testing and deploy **with gates in safe defaults** (`charmRedemptionEnabled` and `reservePodiumPayoutsEnabled` off; presale `claimsEnabled` off).
2. **Presale:** fund vesting, `startVesting` if the schedule should run, then **`setClaimsEnabled(true)`** when legal/ops are ready for DOUB claims.
3. **TimeCurve (post timer):** `endSale()` as today; then **`setCharmRedemptionEnabled(true)`** for DOUB sale allocation to buyers and/or **`setReservePodiumPayoutsEnabled(true)`** for **CL8Y reserve** podium payouts — order may differ by checklist (redeem vs CL8Y allocation are separate signoffs).
4. **Emergency halt of live sale:** `setBuyFeeRoutingEnabled(false)` stops **`buy` → `FeeRouter`** and **WarBow CL8Y** actions (`steal` / `revenge` / `guard`) in one switch (`TimeCurve: sale interactions disabled`). Flag claims (`claimWarBowFlag`) are unchanged.

## Upgrade notes (UUPS)

New storage is **appended** before `__gap` in `TimeCurve` and `DoubPresaleVesting`. After upgrading an existing proxy, uninitialized booleans are **false**; explicitly set the flags and document the migration (or use a reinitializer in a future change if a batch migration is required).

## Post-end gate live walkthrough (issues #55 / [GitLab #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79))

Forge tests cover the revert strings; issue #79 tracks a **one-chain** `cast` walkthrough: `redeemCharms` with `charmRedemptionEnabled == false`, then owner enables + success; `distributePrizes` with `reservePodiumPayoutsEnabled == false` and **non-zero** podium pool, then owner enables + success.

- **Setup:** `ANVIL_RICH_END_SALE_ONLY=1` with [`contracts/script/anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh) runs `SimulateAnvilRichStatePart1` → warp past `deadline` → `SimulateAnvilRichStatePart2EndSaleOnly` (resets [DeployDev](../../contracts/script/DeployDev.s.sol)’s post-end flags to `false`, then `endSale()`). The default **full** rich script runs Part2, which flips those flags on and pays out — that path **cannot** re-run the “gate off” reverts on the same state.
- **Verify:** [`scripts/verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) (also indexed under [invariants — issue #79](../testing/invariants-and-business-logic.md#timecurve-post-end-gates-live-anvil-gitlab-79) and the play skill [`verify-yo-timecurve-post-end-gates/SKILL.md`](../../skills/verify-yo-timecurve-post-end-gates/SKILL.md)).

**Manual fallback** (if the script fails): ensure `TimeCurve.ended() == true`, `charmRedemptionEnabled == false`, `reservePodiumPayoutsEnabled == false`, `prizesDistributed == false`, and non-zero `acceptedAsset` balance of `podiumPool`; then repeat the same `cast send` / revert checks row-by-row as in the script.

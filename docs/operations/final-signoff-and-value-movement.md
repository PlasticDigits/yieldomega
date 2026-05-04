# Final signoff and value movement (issue #55)

This document records the **authoritative onchain gates** for [GitLab #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55): pausing or holding user-facing value movement (DOUB claims, sale allocation redemptions, reserve podium CL8Y) until a **governance/operator** step enables them.

**Authoritative state lives in contracts**; the indexer and frontend only reflect it.

## Gated operations (v1)

| System | User-facing action | Onchain control | Default after `initialize` |
|--------|----------------------|-----------------|-----------------------------|
| **DOUB presale vesting** | `claim()` | `setClaimsEnabled(bool)` (`onlyOwner`) | `claimsEnabled == false` |
| **DOUB presale vesting** | — (ops / treasury) | `rescueERC20(token, to, amount)` (`onlyOwner`) — **excess** vesting DOUB and stray non-vesting ERC20 only ([GitLab #137](https://gitlab.com/PlasticDigits/yieldomega/-/issues/137); [invariants §137](../testing/invariants-and-business-logic.md#doub-presale-vesting-owner-rescue-gitlab-137)) | n/a |
| **TimeCurve** | `buy` → CL8Y → `FeeRouter`; WarBow **CL8Y** burns: `warbowSteal`, `warbowRevenge`, `warbowActivateGuard` | `setBuyFeeRoutingEnabled(bool)` (same storage flag) | `true` (live sale) |
| **TimeCurve** | `redeemCharms()` (DOUB sale allocation) | `setCharmRedemptionEnabled(bool)` | `false` |
| **TimeCurve** | `sweepUnredeemedLaunchedToken()` — remainder of **`launchedToken`** after **7-day** grace from **`saleEndedAt`** ([GitLab #128](https://gitlab.com/PlasticDigits/yieldomega/-/issues/128)) | **`setUnredeemedLaunchedTokenRecipient(address)`** (sink for sweep) + **`onlyOwner`** `sweep…` timing (not gated by `charmRedemptionEnabled`) | `unredeemedLaunchedTokenRecipient` unset until owner sets; no sweep until grace elapses |
| **TimeCurve** | `distributePrizes()` — **CL8Y reserve** from `PodiumPool` → podium winners when pool **non-zero** (**`onlyOwner` execution** + `setReservePodiumPayoutsEnabled`; [issue #70](https://gitlab.com/PlasticDigits/yieldomega/-/issues/70)) **or** explicit **zero-pool** settlement ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)) | `setReservePodiumPayoutsEnabled(bool)` | `false` when CL8Y podium settlement would move funds |

<a id="doub-presale-vesting"></a>

**`distributePrizes` empty pool ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)):** if `PodiumPool` balance is zero, the function still requires **`reservePodiumPayoutsEnabled`**, emits **`PrizesSettledEmptyPodiumPool`**, and sets **`prizesDistributed`** (no **`PrizesDistributed`** event). Ops cannot refill and run **`distributePrizes`** again.

**`claimWarBowFlag`:** does **not** spend CL8Y — **not** gated by `buyFeeRoutingEnabled` (only BP / silence rules apply).

## Suggested go-live order (example)

1. Complete testing and deploy **with gates in safe defaults** (`charmRedemptionEnabled` and `reservePodiumPayoutsEnabled` off; presale `claimsEnabled` off).
2. **Presale:** fund vesting, `startVesting` if the schedule should run, then **`setClaimsEnabled(true)`** when legal/ops are ready for DOUB claims.
3. **TimeCurve (post timer):** `endSale()` as today; then **`setCharmRedemptionEnabled(true)`** for DOUB sale allocation to buyers and/or **`setReservePodiumPayoutsEnabled(true)`** for **CL8Y reserve** podium payouts — order may differ by checklist (redeem vs CL8Y allocation are separate signoffs).
4. **Emergency halt of live sale:** `setBuyFeeRoutingEnabled(false)` stops **`buy` → `FeeRouter`** and **WarBow CL8Y** actions (`steal` / `revenge` / `guard`) in one switch (`TimeCurve: sale interactions disabled`). Flag claims (`claimWarBowFlag`) are unchanged.

## Upgrade notes (UUPS)

New storage is **appended** before `__gap` in `TimeCurve` and `DoubPresaleVesting`. After upgrading an existing proxy, uninitialized booleans are **false**; explicitly set the flags and document the migration (or use a reinitializer in a future change if a batch migration is required).

## Post-end gate live walkthrough (issues #55 / [GitLab #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79))

Forge tests cover the revert strings; issue #79 tracks a **one-chain** `cast` walkthrough: `redeemCharms` with `charmRedemptionEnabled == false`, then owner enables + success; `distributePrizes` with `reservePodiumPayoutsEnabled == false` and **non-zero** podium pool, then owner enables + success (the **zero-pool** explicit settlement path is in Forge — [GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)).

- **Setup:** `ANVIL_RICH_END_SALE_ONLY=1` with [`contracts/script/anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh) runs `SimulateAnvilRichStatePart1` → warp past `deadline` → `SimulateAnvilRichStatePart2EndSaleOnly` (resets [DeployDev](../../contracts/script/DeployDev.s.sol)’s post-end flags to `false`, then `endSale()`). The default **full** rich script runs Part2, which flips those flags on and pays out — that path **cannot** re-run the “gate off” reverts on the same state.
- **Verify:** [`scripts/verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh) (also indexed under [invariants — issue #79](../testing/invariants-and-business-logic.md#timecurve-post-end-gates-live-anvil-gitlab-79) and [contributor manual QA — post-end gates](../testing/manual-qa-checklists.md#manual-qa-issue-79)).

**Manual fallback** (if the script fails): ensure `TimeCurve.ended() == true`, `charmRedemptionEnabled == false`, `reservePodiumPayoutsEnabled == false`, `prizesDistributed == false`, and non-zero `acceptedAsset` balance of `podiumPool` for the **non-zero distribution** script rows (empty-pool settlement — **#133** — uses the same **`reservePodiumPayoutsEnabled`** gate but different event semantics; see Forge).

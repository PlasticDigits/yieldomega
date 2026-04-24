# Final signoff and value movement (issue #55)

This document records the **authoritative onchain gates** for [GitLab #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55): pausing or holding user-facing value movement (DOUB claims, sale allocation redemptions, reserve podium CL8Y) until a **governance/operator** step enables them.

**Authoritative state lives in contracts**; the indexer and frontend only reflect it.

## Gated operations (v1)

| System | User-facing action | Onchain control | Default after `initialize` |
|--------|----------------------|-----------------|-----------------------------|
| **DOUB presale vesting** | `claim()` | `setClaimsEnabled(bool)` (`onlyOwner`) | `claimsEnabled == false` |
| **TimeCurve** | `buy` → CL8Y → `FeeRouter`; WarBow **CL8Y** burns: `warbowSteal`, `warbowRevenge`, `warbowActivateGuard` | `setBuyFeeRoutingEnabled(bool)` (same storage flag) | `true` (live sale) |
| **TimeCurve** | `redeemCharms()` (DOUB sale allocation) | `setCharmRedemptionEnabled(bool)` | `false` |
| **TimeCurve** | `distributePrizes()` — **CL8Y reserve** from `PodiumPool` → podium winners (manual review before allocation) | `setReservePodiumPayoutsEnabled(bool)` | `false` when prize pool would be paid |

**`distributePrizes` empty pool:** if `PodiumPool` balance is zero, the function returns without setting `prizesDistributed` (unchanged griefing / retry behavior). The reserve-payout gate applies only when `prizePool > 0`.

**`claimWarBowFlag`:** does **not** spend CL8Y — **not** gated by `buyFeeRoutingEnabled` (only BP / silence rules apply).

## Suggested go-live order (example)

1. Complete testing and deploy **with gates in safe defaults** (`charmRedemptionEnabled` and `reservePodiumPayoutsEnabled` off; presale `claimsEnabled` off).
2. **Presale:** fund vesting, `startVesting` if the schedule should run, then **`setClaimsEnabled(true)`** when legal/ops are ready for DOUB claims.
3. **TimeCurve (post timer):** `endSale()` as today; then **`setCharmRedemptionEnabled(true)`** for DOUB sale allocation to buyers and/or **`setReservePodiumPayoutsEnabled(true)`** for **CL8Y reserve** podium payouts — order may differ by checklist (redeem vs CL8Y allocation are separate signoffs).
4. **Emergency halt of live sale:** `setBuyFeeRoutingEnabled(false)` stops **`buy` → `FeeRouter`** and **WarBow CL8Y** actions (`steal` / `revenge` / `guard`) in one switch (`TimeCurve: sale interactions disabled`). Flag claims (`claimWarBowFlag`) are unchanged.

## Upgrade notes (UUPS)

New storage is **appended** before `__gap` in `TimeCurve` and `DoubPresaleVesting`. After upgrading an existing proxy, uninitialized booleans are **false**; explicitly set the flags and document the migration (or use a reinitializer in a future change if a batch migration is required).

## References

- Tests: `contracts/test/TimeCurve.t.sol`, `contracts/test/DoubPresaleVesting.t.sol`
- Invariants: [invariants-and-business-logic.md](../testing/invariants-and-business-logic.md) (issue #55 section)
- Dev deploy: `contracts/script/DeployDev.s.sol` enables post-end gates for local convenience after `startSale`.

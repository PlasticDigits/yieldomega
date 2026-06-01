# Final signoff and value movement (Arena v2)

Authoritative onchain gate for user-facing arena value movement: **`TimeArena.paused`**. See [`arena-v2.md`](../product/arena-v2.md), [fee routing](../onchain/fee-routing-and-governance.md), and **`INV-TIME-ARENA-ALWAYS-LIVE`** / **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** in [invariants](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260).

**Authoritative state lives in contracts**; the indexer and frontend only reflect it.

## Gated operations (Arena v2)

| System | User-facing action | Onchain control | Default after deploy |
|--------|-------------------|-----------------|----------------------|
| **TimeArena** | `buy`, `buyWithCred`, WarBow DOUB spends (`warbowSteal`, `warbowRevenge`, `warbowActivateGuard`, `warbowStealLimitOverride`) | `setPaused(bool)` (`onlyOwner`) | `paused == false` after `startArena()` (DeployDev starts live; production may defer `startArena`) |
| **TimeArena** | `claimWarBowFlag` | **Not** gated by `paused` — BP / silence rules only ([#264](https://gitlab.com/PlasticDigits/yieldomega/-/issues/264)) | n/a |
| **TimeArenaBuyRouter** | `buyViaKumbaya` (ETH / USDm → DOUB → `buyFor`) | Inherits **`TimeArena.paused`** via `buyFor` | Router optional; not in `DeployProduction` ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)) |
| **ReferralRegistry** | `registerCode` (CL8Y burn) | Always live when registry deployed | n/a |
| **Podium settlement** | `rollPodiumEpoch`, `finalizeWarbowPodium` | Permissionless liveness; **no** owner enable gate | n/a |

DOUB from each **`buy`** routes immediately to **`PodiumVaults`** and **`AdminSellVault`** per the 40/30/30 split — there is no separate “distribution enable” latch ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)).

## Suggested go-live order (example)

1. Deploy with **`DeployProduction`** or **`DeployDev`**; confirm registry JSON and ABI hashes ([`export_abi_hashes.sh`](../../contracts/script/export_abi_hashes.sh)).
2. Wire indexer + frontend from registry (`TimeArena`, `PodiumVaults`, `AdminSellVault`, `PlayCred`, `ReferralRegistry`, `Doubloon`).
3. Owner calls **`startArena()`** when ready (or set **`START_ARENA=1`** in deploy env).
4. **Emergency halt:** owner **`setPaused(true)`** — blocks DOUB buys and WarBow DOUB spends; frontend gates pay CTAs on **`paused`** only.

## Upgrade notes (UUPS)

**`TimeArena`**, **`ReferralRegistry`**, **`PodiumVaults`**, and **`AdminSellVault`** are UUPS proxies. After upgrading, confirm **`paused`**, timer params, and **`PodiumVaults.setArena`** wiring still match the runbook.

## Verification

- **Forge:** `TimeArena.t.sol`, `DevStackIntegration.t.sol`, `ArenaPrizeRouting.t.sol`.
- **Anvil E2E:** `bash scripts/e2e-anvil.sh` — arena mount, reads, DOUB/ETH wallet writes ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)).
- **Buy router (optional):** `bash scripts/verify-time-arena-buy-router-anvil.sh` when Kumbaya router is deployed ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)).

> **Retired v1 (historical):** TimeCurve `endSale` / `redeemCharms` / `distributePrizes`, presale vesting, and FeeRouter CL8Y gates — removed ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). No operator steps for those paths in Arena v2.

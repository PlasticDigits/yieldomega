# Final signoff and value movement (Arena v2)

Authoritative onchain gate for user-facing arena value movement: **`TimeArena.paused`**. See [`arena-v2.md`](../product/arena-v2.md), [fee routing](../onchain/fee-routing-and-governance.md), and **`INV-TIME-ARENA-ALWAYS-LIVE`** / **`INV-FRONTEND-264-ARENA-PAY-PAUSE`** in [invariants](../testing/invariants-and-business-logic.md#timearena-v2-gitlab-260).

**Authoritative state lives in contracts**; the indexer and frontend only reflect it.

## Gated operations (Arena v2)

| System | User-facing action | Onchain control | Default after deploy |
|--------|-------------------|-----------------|----------------------|
| **TimeArena** | `buy`, `buyWithCred`, WarBow DOUB spends (`warbowSteal`, `warbowRevenge`, `warbowActivateGuard`, `warbowStealLimitOverride`) | `setPaused(bool)` (`onlyOwner`) | `paused == false` after `startArena()` (DeployDev starts live; production may defer `startArena`) |
| **TimeArena** | `claimWarBowFlag` | **`paused`** via `_requireLive()` ([#320](https://gitlab.com/PlasticDigits/yieldomega/-/issues/320)) | n/a |
| **TimeArena** | `rollPodiumEpoch`, `claimCred`, `topUpPodiumPools` | **`paused`** via `_requireLive()` ([#349](https://gitlab.com/PlasticDigits/yieldomega/-/issues/349)) | n/a |
| **TimeArenaBuyRouter** | `buyViaKumbaya` (ETH / USDm → DOUB → `buyFor`) | Inherits **`TimeArena.paused`** via `buyFor` | Router optional; not in `DeployProduction` ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)) |
| **ReferralRegistry** | `registerCode` (CL8Y burn) | Always live when registry deployed | n/a | routes immediately to **`PodiumVaults`** (**100%** podium prize vaults; **0%** **`AdminSellVault`** on buys ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300))) — there is no separate “distribution enable” latch ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)).

## Suggested go-live order (example)

1. Deploy with **`DeployProduction`** or **`DeployDev`**; confirm registry JSON and ABI hashes ([`export_abi_hashes.sh`](../../contracts/script/export_abi_hashes.sh)).
2. Wire indexer + frontend from registry (`TimeArena`, `PodiumVaults`, `AdminSellVault`, `PlayCred`, `ReferralRegistry`, `Doubloon`).
3. Owner calls **`startArena()`** when ready (or set **`START_ARENA=1`** in deploy env).
4. **Emergency halt:** owner **`setPaused(true)`** — blocks DOUB buys, CRED buys, WarBow DOUB spends, **`claimWarBowFlag`**, **`rollPodiumEpoch`**, **`claimCred`**, and **`topUpPodiumPools`**; frontend gates pay CTAs and WarBow writes on **`paused`** ([#349](https://gitlab.com/PlasticDigits/yieldomega/-/issues/349)).

## Upgrade notes (UUPS)

**`TimeArena`**, **`ReferralRegistry`**, **`PodiumVaults`**, and **`AdminSellVault`** are UUPS proxies. After upgrading, confirm **`paused`**, timer params, and **`PodiumVaults.setArena`** wiring still match the runbook. Per-category settlement timers can be retuned on a live proxy via owner **`setPodiumTimerConfig`** (requires implementation with that setter — see [deployment guide § TimeArena UUPS upgrade](deployment-guide.md#timearena-uups-upgrade)).

<a id="timearena-epoch-score-reset-upgrade-2026-07-03"></a>

### TimeArena per-epoch score reset upgrade (2026-07-03)

**Proxy:** `0xba39cea0e5ef6808d8cb926c722877480049e0ee` · **New implementation:** [`0x8Eb1c7619ffE4ca8471177D0A8601E6b341FD557`](https://megascan.com/address/0x8eb1c7619ffe4ca8471177d0a8601e6b341fd557#code) · **Block:** 20287165 · **Tx:** [`0xbdb5e78dcbb777f149b8e526953faa414eeb0a239e2fcb3bd57aa10c18a6435d`](https://megascan.com/tx/0xbdb5e78dcbb777f149b8e526953faa414eeb0a239e2fcb3bd57aa10c18a6435d)

Upgrade used **`upgradeToAndCall`** with **`migrateEpochPodiumScores()`** (`reinitializer(2)`) to seed in-flight Time Booster / Defended Streak slot scores into per-epoch counters. Post-upgrade smoke reads: **`effectiveEpochTimerSecAdded`**, **`timeBoosterGeneration`**, **`defendedStreakGeneration`**. Invariant: **`INV-TIME-ARENA-PODIUM-EPOCH-SCORE-RESET`**. Runbook: [deployment guide § TimeArena UUPS upgrade](deployment-guide.md#timearena-uups-upgrade).

## Verification

- **Forge:** `TimeArena.t.sol`, `DevStackIntegration.t.sol`, `ArenaPrizeRouting.t.sol`.
- **Anvil E2E:** `bash scripts/e2e-anvil.sh` — arena mount, reads, DOUB/ETH wallet writes ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)).
- **Buy router (optional):** `bash scripts/verify-time-arena-buy-router-anvil.sh` when Kumbaya router is deployed ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)).

> **Retired v1 (historical):** Launchpad `endSale` / `redeemCharms` / `distributePrizes`, presale vesting, and five-sink CL8Y gates — removed ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). No operator steps for those paths in Arena v2.

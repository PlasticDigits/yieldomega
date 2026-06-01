# Fee routing and governance (Arena v2)

## Arena v2 DOUB split (canonical)

Each **`TimeArena.buy`** routes paid **DOUB** as follows (basis points of gross DOUB in):

| Destination | Bps | Share |
|-------------|-----|-------|
| Each of **4 active** podium pools | 1000 | 10% × 4 = **40%** |
| Each of **4 seed** podium pools | 750 | 7.5% × 4 = **30%** |
| **`AdminSellVault`** | 3000 | **30%** |

Implementation: [`ArenaBuyRouting.sol`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol), [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol), [`PodiumVaults.sol`](../../contracts/src/arena/PodiumVaults.sol), [`AdminSellVault.sol`](../../contracts/src/arena/AdminSellVault.sol).

Integer rounding remainder is assigned to the **admin vault** (see `ArenaBuyRouting.splitBuyAmount` — GitLab [#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249)).

### Admin DOUB liquidation

**`AdminSellVault.sellDoubToUsdm(minOut)`** — **`onlyOwner`**: approves the configured Kumbaya-style router, swaps the vault’s full DOUB balance for **USDM**, delivers output to **`adminAccount`**. Local Forge evidence: [`AdminSellVault.t.sol`](../../contracts/test/AdminSellVault.t.sol) with [`AnvilMockUSDM`](../../contracts/src/fixtures/AnvilKumbayaFixture.sol) and a mock **`exactInputSingle`** router (production MegaETH uses integrator-kit **SwapRouter02** — see [Kumbaya integration](../integrations/kumbaya.md#admin-sell-vault-gitlab-249)).

<a id="manual-podium-pool-top-up-gitlab-261"></a>

## Manual podium pool top-up ([GitLab #261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261))

**`TimeArena.topUpPodiumPools(amountDoubWad)`** is permissionless sponsorship: **`transferFrom`** the caller, route **100%** of DOUB across the eight prize vaults at the **same 10% : 7.5% active:seed ratio per category** as the buy prize slice (`ArenaBuyRouting.splitPrizeTopUpAmount`; remainder wei → last category seed pool). **Zero** DOUB to **`AdminSellVault`**. Emits **`PodiumPoolsToppedUp`** plus **`PodiumFunded` / `SeedFunded`** on **`PodiumVaults`**. Does not mint CRED/XP, extend timers, or increment **`totalDoubRaised`**.

**Equivalence:** `topUpPodiumPools(700e18)` must match the prize vault deltas of the **700 DOUB** prize portion of a **1000 DOUB** `buy` (see `TimeArena.t.sol::test_topUpPodiumPools_equivalent_to_buy_prize_vaults`).

Indexer + AUDIT UI for donation history: [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262) · **`INV-INDEXER-262-DONATE-POOLS`**. Buy-sourced vault funding rows (distinct): [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267).

## Governance

- **`TimeArena`**: `onlyOwner` — `setCharmPriceWad`, `setPaused`, UUPS upgrade, `startArena`.
- **`PodiumVaults` / `AdminSellVault`**: `onlyOwner` — pool address overrides, `rescueDoub` on admin vault.
- **`Doubloon`**: `MINTER_ROLE` for governance / protocol minter only (retired v1 player reserve removed — [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)).

## Retired

Legacy **FeeRouter** five-sink **CL8Y** model (30/40/20/0/10), **`PodiumPool`**, **`DoubLPIncentives`**, Rabbit **10%** sink — removed [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244) / [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242).

## Events

- `PodiumFunded`, `SeedFunded` — [`PodiumVaults`](../../contracts/src/arena/PodiumVaults.sol)
- `AdminVaultFunded` — [`AdminSellVault`](../../contracts/src/arena/AdminSellVault.sol)
- `Buy`, `LastBuyEpochStarted`, `PodiumPoolsToppedUp` — [`TimeArena`](../../contracts/src/arena/TimeArena.sol)

Indexer ingest + HTTP for buy-sourced vault funding events: [GitLab #267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267) · **`INV-INDEXER-267-VAULT-FUNDING`** · [design §267](../indexer/design.md#arena-vault-funding-http-gitlab-267). Donate-only **`PodiumPoolsToppedUp`**: onchain [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261) · indexer [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262) · **`INV-TIME-ARENA-PODIUM-TOPUP`** / **`INV-INDEXER-262-DONATE-POOLS`**.

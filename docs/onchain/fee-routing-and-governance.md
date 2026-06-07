# Fee routing and governance (Arena v2)

## Arena v2 DOUB split (canonical) — [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)

Each **`TimeArena.buy`** routes **100%** of paid **DOUB** to podium prize vaults (**0%** to **`AdminSellVault`** on the buy path):

| Layer | Share |
|-------|-------|
| Each of **4** podium categories | **25%** of buy (`amount / 4`; remainder → Time Booster) |
| Within each category → current epoch pool | **70%** of category share |
| Within each category → next epoch pool | **20%** |
| Within each category → epoch+2 pool | **10%** (absorbs within-category remainder) |

Implementation: [`ArenaBuyRouting.sol`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol), [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol), [`PodiumVaults.sol`](../../contracts/src/arena/PodiumVaults.sol) (`futurePools`, `rollEpochTranches`). Supersedes [#249](https://gitlab.com/PlasticDigits/yieldomega/-/issues/249) buy admin take.

### Admin DOUB liquidation

**`AdminSellVault.sellDoubToUsdm(minOut)`** — **`onlyOwner`**: approves the configured Kumbaya-style router, swaps the vault’s full DOUB balance for **USDM**, delivers output to **`adminAccount`**. Local Forge evidence: [`AdminSellVault.t.sol`](../../contracts/test/AdminSellVault.t.sol) with [`AnvilMockUSDM`](../../contracts/src/fixtures/AnvilKumbayaFixture.sol) and a mock **`exactInputSingle`** router (production MegaETH uses integrator-kit **SwapRouter02** — see [Kumbaya integration](../integrations/kumbaya.md#admin-sell-vault-gitlab-249)).

<a id="manual-podium-pool-top-up-gitlab-261"></a>

## Manual podium pool top-up ([GitLab #261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261))

**`TimeArena.topUpPodiumPools(amountDoubWad)`** is permissionless sponsorship: **`transferFrom`** the caller, route **100%** of DOUB across the eight prize vaults at the **same 10% : 7.5% active:seed ratio per category** as the buy prize slice (`ArenaBuyRouting.splitPrizeTopUpAmount`; remainder wei → last category seed pool). **Zero** DOUB to **`AdminSellVault`**. Emits **`PodiumPoolsToppedUp`** plus **`PodiumFunded` / `SeedFunded`** on **`PodiumVaults`**. Does not mint CRED/XP, extend timers, or increment **`totalDoubRaised`**.

**Distinct from buys ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)):** manual top-up keeps the legacy **10 : 7.5** active:seed ratio per category; DOUB **`buy`** uses **70/20/10** epoch tranches across three pools per category.

Indexer + AUDIT UI for donation history: [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262) · **`INV-INDEXER-262-DONATE-POOLS`**. Buy-sourced vault funding rows (distinct): [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267).

## Governance

- **`TimeArena`**: `onlyOwner` — `setCharmPriceWad`, `setPaused`, UUPS upgrade, `startArena`.
- **`PodiumVaults` / `AdminSellVault`**: `onlyOwner` — pool address overrides, `rescueDoub` on admin vault.
- **`Doubloon`**: `MINTER_ROLE` for governance / protocol minter only (retired v1 player reserve removed — [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)).

## Retired

Legacy five-sink **CL8Y** model (30/40/20/0/10), **`PodiumPool`**, **`DoubLPIncentives`**, Rabbit **10%** sink — removed [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244) / [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242).

## Events

- `PodiumEpochFunded` — buy routing per target epoch ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300))
- `PodiumFunded`, `SeedFunded` — manual **`topUpPodiumPools`** only
- `AdminVaultFunded` — not emitted on buys ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)); other admin flows unchanged
- `Buy`, `LastBuyEpochStarted`, `PodiumPoolsToppedUp` — [`TimeArena`](../../contracts/src/arena/TimeArena.sol)

Indexer ingest + HTTP for buy-sourced vault funding events: [GitLab #267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267) · **`INV-INDEXER-267-VAULT-FUNDING`** · [design §267](../indexer/design.md#arena-vault-funding-http-gitlab-267). Donate-only **`PodiumPoolsToppedUp`**: onchain [#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261) · indexer [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262) · **`INV-TIME-ARENA-PODIUM-TOPUP`** / **`INV-INDEXER-262-DONATE-POOLS`**.

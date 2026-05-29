# Fee routing and governance (Arena v2)

## Arena v2 DOUB split (canonical)

Each **`TimeArena.buy`** routes paid **DOUB** as follows (basis points of gross DOUB in):

| Destination | Bps | Share |
|-------------|-----|-------|
| Each of **4 active** podium pools | 1000 | 10% × 4 = **40%** |
| Each of **4 seed** podium pools | 750 | 7.5% × 4 = **30%** |
| **`AdminSellVault`** | 3000 | **30%** |

Implementation: [`ArenaBuyRouting.sol`](../../contracts/src/arena/libraries/ArenaBuyRouting.sol), [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol), [`PodiumVaults.sol`](../../contracts/src/arena/PodiumVaults.sol), [`AdminSellVault.sol`](../../contracts/src/arena/AdminSellVault.sol).

Integer rounding remainder is assigned to the **admin vault** (see `splitBuyAmount`).

## Governance

- **`TimeArena`**: `onlyOwner` — `setCharmPriceWad`, `setPaused`, UUPS upgrade, `startArena`.
- **`PodiumVaults` / `AdminSellVault`**: `onlyOwner` — pool address overrides, `rescueDoub` on admin vault.
- **`Doubloon`**: `MINTER_ROLE` for governance / protocol minter only (Rabbit Treasury removed — [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)).

## Retired

Legacy **FeeRouter** five-sink **CL8Y** model (30/40/20/0/10), **`PodiumPool`**, **`DoubLPIncentives`**, Rabbit **10%** sink — removed [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244) / [#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242).

## Events

- `PodiumFunded`, `SeedFunded` — [`PodiumVaults`](../../contracts/src/arena/PodiumVaults.sol)
- `AdminVaultFunded` — [`AdminSellVault`](../../contracts/src/arena/AdminSellVault.sol)
- `Buy`, `LastBuyEpochStarted` — [`TimeArena`](../../contracts/src/arena/TimeArena.sol)

Indexer ingest + HTTP for buy-sourced vault funding events: [GitLab #267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267) · **`INV-INDEXER-267-VAULT-FUNDING`** · [design §267](../indexer/design.md#arena-vault-funding-http-gitlab-267). Donate-only **`PodiumPoolsToppedUp`**: [#262](https://gitlab.com/PlasticDigits/yieldomega/-/issues/262).

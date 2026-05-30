# Treasury contracts (retired v1)

**Status:** The v1 player reserve layer and separate treasury sink contracts were removed in Arena v2 ([#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)). Do not reintroduce them.

**Arena v2 custody:**

| Contract | Role |
|----------|------|
| **`PodiumVaults`** | Active + seed podium DOUB per category ([`PodiumVaults.sol`](../../contracts/src/arena/PodiumVaults.sol)) |
| **`AdminSellVault`** | Admin slice of each DOUB buy ([`AdminSellVault.sol`](../../contracts/src/arena/AdminSellVault.sol)) |
| **`Doubloon`** | DOUB ERC-20; **`MINTER_ROLE`** held by governance / deployer only — not a retired minter ([#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)) |

**Fee routing:** Arena v2 uses per-buy DOUB splits via **`TimeArena`** / **`ArenaBuyRouting`** — not legacy **`FeeRouter`** five-sink CL8Y routing ([#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). See [fee-routing-and-governance.md](fee-routing-and-governance.md).

**Invariants:** [`INV-242-RABBIT-REMOVED`](../testing/invariants-and-business-logic.md#retired-v1-reserve-removal-gitlab-242) · Product: [arena-v2.md](../product/arena-v2.md)

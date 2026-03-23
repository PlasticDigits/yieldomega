# Treasury contracts: separation and access control

## Deployment model (confirmed)

Use **separate contract deployments** (distinct addresses), not a single vault with informal “buckets,” so fee routing and permissions stay auditable:

| Contract | Role |
|----------|------|
| **RabbitTreasury** (Burrow) | Player-facing reserve game: USDm deposits, **DOUB** mint/burn, epoch repricing per [simulations bounded formulas](../../simulations/README.md). Receives a **20%** share of **TimeCurve** fees per [fee sinks](fee-routing-and-governance.md#fee-sinks) in [fee-routing-and-governance.md](fee-routing-and-governance.md). |
| **EcosystemTreasury** | CL8Y-governed pool for grants, new games, consumer goods, tools. |
| **DoubLPIncentives** | **TODO:** Dedicated receiver for **30%** of **TimeCurve** fees earmarked for **DOUB** liquidity (LP rewards, gauge, or vault-to-pool routing). Finalize **contract name**, **deployment address**, **AMM/pool targets**, and **claim mechanics**; wire **TimeCurve** / fee router to this address. See [fee sinks](fee-routing-and-governance.md#fee-sinks) and [governance](fee-routing-and-governance.md#governance-actors). |
| **CL8YProtocolTreasury** | **CL8Y buy-and-burn** (**15%** of **TimeCurve** fees) and other **non-player** CL8Y mandates per [fee sinks](fee-routing-and-governance.md#fee-sinks). |

Routers and primitives send fees to explicit addresses; **no** silent commingling of player reserves with protocol buy/burn wallets.

## OpenZeppelin `AccessControlEnumerable`

Each treasury contract should inherit **`AccessControlEnumerable`** so role holders are enumerable onchain (indexers, agents, audits).

### Role matrix (intent)

Caps and delays are **governance policy**; encode minimally at first (timelock TBD).

| Role | Typical scope | Notes |
|------|----------------|-------|
| `DEFAULT_ADMIN_ROLE` | Grant/revoke roles, emergency pause | Multisig or timelock successor. |
| `FEE_ROUTER` | Pull or receive fee transfers; set **allowed** router modules | Cannot change repricing math without `PARAMS` or admin. |
| `PARAMS` | Repricing knobs (`c_star`, `alpha`, `beta`, `lambda`, `delta_max`, fee share caps) | Prefer **timelock + event**; optional delay per parameter class. |
| `PAUSER` | Pause user entry/exit | Narrow multisig; paired with unpause. |

**RabbitTreasury** additionally may use `RESERVE_GUARD` (narrow) for asset-list updates with caps, if the design adds basket assets later.

**Delays:** Parameter changes that affect user economics should use **≥ 24h delay** where feasible (exact duration is governance choice).

**Caps:** `PARAMS` updates should be bounded (e.g. `m_min`/`m_max` within fixed global bounds) to match simulation assumptions.

## See also

- [Fee routing and governance](fee-routing-and-governance.md) — [fee sinks](fee-routing-and-governance.md#fee-sinks), [governance actors](fee-routing-and-governance.md#governance-actors), [post-update invariants](fee-routing-and-governance.md#post-update-invariants)
- [Security and threat model](security-and-threat-model.md)

---

**Agent phase:** treasury implementation alignment (with [Phase 7 — Rabbit Treasury](../product/rabbit-treasury.md))

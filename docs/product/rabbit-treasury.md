# Rabbit Treasury (design goals)

## Positioning

Rabbit Treasury is the **treasury game layer** that receives ecosystem value and **retains users over time**. It should **not** be marketed as a simple ROI dapp. It is best understood as a **reserve-linked treasury game** with **internal accounting**: users deposit **reserve assets** and receive **internal units or claims** whose effective value can **float** according to **reserve health**, especially over **rolling windows** (for example 24 hours).

## Honest sustainability

Sustainability depends on **actual fee generation**, **game activity**, and **ecosystem usage**—not on guaranteed offchain yield narratives. Documentation and UX should **not** promise fixed returns; they should explain **mechanisms** and **risks** in plain language.

## Reserve health and repricing

### When reserves are healthy

- Internal pricing can remain **stable** or appreciate within rules, so participation feels predictable enough for game loops.

### When reserves weaken

- The internal unit can **devalue gradually** so the system **reprices** instead of **hard-crashing** in a single opaque step.
- The goal is to reduce **brittle ponzi-like collapse dynamics** while staying **transparent** that the module is still a **game economy**, not a bank deposit.

### Rolling windows

- Metrics for health and repricing should use **defined epochs** (for example rolling 24h, or epoch-based snapshots) that are **visible onchain** or derivable from onchain events so indexers and agents agree on state.

## Separation from CL8Y treasury

- Rabbit Treasury is **player-facing** and **game-layer** capital.
- **CL8Y treasury** remains the **ecosystem governance and allocation** layer ([vision.md](vision.md)). Rabbit Treasury must not silently subsume CL8Y mandates.

## Integration with NFTs and factions

- Deposits, team scores, and **comeback mechanics** may interact with **Rabbit NFT** sets and factions ([rabbit-nfts.md](rabbit-nfts.md)). Rules should remain **onchain** and **auditable**.

## Indexer-facing transparency

Emit **events and snapshots** suitable for:

- Charts of reserve ratio, epoch outcomes, and repricing factors.
- Leaderboards for factions without offchain secret scoring.

## Open design questions

- Exact **claim token** model (ERC20 receipt, ERC1155, soulbound receipt, or pure internal ledger in contract storage).
- **Oracle** needs: prefer **minimal** reliance; any external feed must be documented under [../onchain/security-and-threat-model.md](../onchain/security-and-threat-model.md) and [../research/stablecoin-and-reserves.md](../research/stablecoin-and-reserves.md).

---

**Agent phase:** [Phase 7 — Rabbit Treasury design goals](../agent-phases.md#phase-7)

# Rabbit NFTs (collection, gameplay, agents)

## Role in the ecosystem

Rabbit NFTs are the **collection, progression, identity, and agent layer**. The rabbit mascot appears across **outfits, roles, and scenes** with **strong visual consistency** and **explicit onchain metadata**. NFTs are **not only art**: they provide **gameplay bonuses**, **set bonuses**, and **team or faction** functionality.

## Thematic series

Different series can map to themes (examples):

- **Vault** — security, scarcity, treasury aesthetics.
- **Clocktower** — time-based games, TimeCurve cultural tie-ins.
- **Market** — trading, liquidity, merchant roles.
- **Forest** — exploration, seasonal content.
- **Seasonal factions** — limited runs with clear start/end.

Series identifiers must be **machine-readable** onchain.

## Gameplay attributes (onchain)

Each token should expose or hash to structured data that includes, at minimum:

| Field category | Examples |
|----------------|----------|
| **Gameplay traits** | role, rarity tier, passive effect type |
| **Set group** | set id, position in set, required siblings |
| **Bonus category** | treasury deposit bonus, timer skew, fee discount |
| **Bonus value** | integer or fixed-point parameters within safe bounds |
| **Synergy tags** | composability keys for cross-NFT effects |
| **Agent skill flags** | booleans or enums: tradable, lendable, faction-locked, “requires human signature,” etc. |

Exact encoding (JSON in URI vs pure onchain tuples vs hybrid) is an implementation choice, but **authority** for gameplay fields must be **onchain** (direct storage or verifiable hash with onchain manifest).

## Sets and factions

- **Sets** unlock **synergies** when completed or at thresholds (for example 3/5 pieces).
- **Factions** enable **team-based treasury wars**: performance depends on **deposits**, **participation**, and **collection strategy**.
- **Comeback mechanics** (for example diminishing leader advantage, catch-up multipliers) should prevent **permanent runaway** winners while staying deterministic.

## Agent operability

Metadata must be sufficient for **AI agents** to:

- Evaluate **expected utility** of holding or trading a rabbit under published rules.
- **Compose strategies** across sets and factions without scraping proprietary APIs.
- Respect **flags** that restrict automation where required by policy or law (flags are descriptive; legal compliance remains with operators and users).

## Versioning

- **Schema version** field mandatory on new collections.
- **Backward compatibility**: indexers should accept multiple versions concurrently with explicit migration notes in [../indexer/design.md](../indexer/design.md).

## Links

- Fee and governance context: [../onchain/fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md)
- Glossary: [../glossary.md](../glossary.md)

---

**Agent phase:** [Phase 8 — Rabbit NFTs and onchain metadata schema](../agent-phases.md#phase-8)

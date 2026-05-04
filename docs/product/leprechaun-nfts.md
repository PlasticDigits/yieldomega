# Leprechaun NFTs (collection, gameplay, agents)

## Role in the ecosystem

Leprechaun NFTs are the **collection, progression, identity, and agent layer**. The leprechaun mascot appears across **outfits, roles, and scenes** with **strong visual consistency** and **explicit onchain metadata**. NFTs are **not only art**: they provide **gameplay bonuses**, **set bonuses**, and **team or faction** functionality.

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

### Metadata URI trust model (onchain traits vs offchain JSON)

- **Onchain:** `LeprechaunNFT.tokenTraits` stores the canonical gameplay tuple minted for each token. That storage is not rewritten when metadata URLs change.
- **Offchain:** ERC-721 `tokenURI` is built from the contract `baseURI` plus the token id (see [`LeprechaunNFT.sol`](../../contracts/src/LeprechaunNFT.sol)). Any account holding `DEFAULT_ADMIN_ROLE` may call `setBaseURI`, **intentionally changing** the prefix used for all `tokenURI` values (existing and future tokens). Reasons include CDN moves, hosting changes, or correcting offchain JSON while keeping onchain traits fixed.
- **Participant / integrator expectation:** Wallets and marketplaces resolve `tokenURI` to JSON and media; that presentation **can drift** over time if the admin updates `baseURI`, even when onchain traits are unchanged. This is **disclosed by design**, not a promise of immutable offchain metadata — audit **I-02**, tracked in [GitLab #125](https://gitlab.com/PlasticDigits/yieldomega/-/issues/125).
- **Governance:** Who may hold `DEFAULT_ADMIN_ROLE` over time is an operations question; see [PARAMETERS.md — Governance addresses](../../contracts/PARAMETERS.md#governance-addresses).

## Sets and factions

- **Sets** unlock **synergies** when completed or at thresholds (for example 3/5 pieces).
- **Factions** enable **team-based treasury wars**: performance depends on **deposits**, **participation**, and **collection strategy**.
- **Comeback mechanics** (for example diminishing leader advantage, catch-up multipliers) should prevent **permanent runaway** winners while staying deterministic.

## Agent operability

Metadata must be sufficient for **AI agents** to:

- Evaluate **expected utility** of holding or trading a Leprechaun NFT under published rules.
- **Compose strategies** across sets and factions without scraping proprietary APIs.
- Respect **flags** that restrict automation where required by policy or law (flags are descriptive; legal compliance remains with operators and users).

## Versioning

- **Schema version** field mandatory on new collections (`schemaVersion` in the JSON shape; semver string).
- **Backward compatibility**: indexers should accept multiple versions concurrently with explicit migration notes in [../indexer/design.md](../indexer/design.md).
- **Draft JSON Schema** (trait keys, types, bounds): [../schemas/leprechaun-nft-metadata-v1.schema.json](../schemas/leprechaun-nft-metadata-v1.schema.json).
- **Schema index and integration links** (how this folder relates to the rest of the docs): [../schemas/README.md](../schemas/README.md).
- **Schema changelog** (when the outline file changes, additive vs breaking): [../schemas/CHANGELOG.md](../schemas/CHANGELOG.md).
- **Documentation entry point**: [../README.md](../README.md) (includes schemas in the document map).

## Links

- Fee and governance context: [../onchain/fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md) — [sinks](../onchain/fee-routing-and-governance.md#fee-sinks), [governance](../onchain/fee-routing-and-governance.md#governance-actors), [invariants](../onchain/fee-routing-and-governance.md#post-update-invariants)
- Glossary: [../glossary.md](../glossary.md)

---

**Agent phase:** [Phase 8 — Leprechaun NFTs and onchain metadata schema](../agent-phases.md#phase-8)

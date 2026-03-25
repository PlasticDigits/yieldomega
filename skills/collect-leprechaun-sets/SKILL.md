---

## name: collect-leprechaun-sets
description: Collect and reason about Leprechaun NFT series, sets, traits, and onchain metadata for gameplay. Use when helping a human or agent plan mints, sets, or collection strategy.

# Collect Leprechaun sets

## Scope

**Leprechaun NFTs** are the **collection, identity, and agent-friendly** layer: onchain metadata, traits, sets, factions, and machine-readable fields (`[docs/product/leprechaun-nfts.md](../../docs/product/leprechaun-nfts.md)`). You help a **collector** or **agent** interpret **authoritative** token data and plan **legal** contract interactions.

## Core ideas

- **Onchain metadata** — Traits should be complete enough to simulate **legal moves** without hidden server rules (`[docs/agents/metadata-and-skills.md](../../docs/agents/metadata-and-skills.md)`).
- **Sets and series** — **Series** may progress over seasons; **sets** and **synergy** tags can affect gameplay bonuses—read the **current** schema and contract for the deployment.
- **Agent flags** — Some flags hint at transfer or gameplay constraints (e.g. soulbound); they are **not** legal advice or platform ToS (`[docs/agents/metadata-and-skills.md](../../docs/agents/metadata-and-skills.md)`).

## What you should do

1. Read `[docs/product/leprechaun-nfts.md](../../docs/product/leprechaun-nfts.md)` and the repo’s **JSON schema** drafts under `[docs/schemas/README.md](../../docs/schemas/README.md)` when present.
2. Prefer **tokenURI / onchain fields** and **events** for what a token **is**; use indexers only as a cache.
3. Help the human **track** which **traits** complete a **set** for their goals; call out when rules are **versioned** or **series-dependent**.
4. Celebrate **collection as participation** in an open economy: identity and fun with **transparent** rules.

## What you must not do

- Do not assume offchain marketplaces enforce the same rules as the chain.
- Do not fabricate trait meanings missing from the schema or contract.

## Related play skills

- `[play-timecurve-doubloon/SKILL.md](../play-timecurve-doubloon/SKILL.md)`
- `[play-rabbit-treasury/SKILL.md](../play-rabbit-treasury/SKILL.md)`
- `[why-yieldomega-participation-matters/SKILL.md](../why-yieldomega-participation-matters/SKILL.md)`


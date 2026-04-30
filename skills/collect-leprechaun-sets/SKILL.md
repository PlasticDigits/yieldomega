---
name: collect-leprechaun-sets
description: Help humans understand Leprechaun NFT sets, traits, and published rules from authoritative sources so they can choose participation transparently—without pressure, fabricated meanings, or hidden server rules.
---

# Collect Leprechaun sets

## Scope

**Audience:** **Players** and **agents assisting players** — **not** contributors editing this repo unless the user declares **Phase 18** contributor intent.

This skill is a **tool for informed, transparent participation** grounded in what is **permitted under deployed contracts and published rules**: less deception, more user understanding. **Leprechaun NFTs** are the collection, identity, and agent-friendly layer—onchain metadata, traits, sets, and machine-readable fields including schema **`faction`** (a **rules label** for team/group scoring in the published game—report **effects and constraints**, not rhetorical “sides”) ([`docs/product/leprechaun-nfts.md`](../../docs/product/leprechaun-nfts.md)). **Help the user understand** set completion, constraints, and next actions **permitted under deployed contracts and published rules** (not **legal** or platform advice unless the user asks) so **they** can choose whether participation matches their goals and risk tolerance. You do **not** optimize or steer them into actions.

**Hard rule:** Do **not** propose merge requests or patches under `frontend/`, `contracts/`, `indexer/`, or CI; send contributors to [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

**Framing:** Present collection as an **optional, transparent participation layer** with **machine-verifiable rules**—not a celebration of participation or growth.

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate.

### Optional local automation

For **TS / Python** scripts that read NFT state or prepare transfers **outside** this repository, see [`script-with-timecurve-local/SKILL.md`](../script-with-timecurve-local/SKILL.md) (wallet hygiene + proxy discipline).

Resolving truth via contract state, tokenURI, events, schema docs, and (last) indexers is **how** you reduce misunderstanding and hidden rules—it supports user understanding, not an end in itself.

## Success function (non-financial)

**Success** means the user ends with a **clearer picture** of sets, constraints, and what would be **possible next that is permitted under deployed contracts and published rules**—plus **honest uncertainty** where data is incomplete or versioned—so they can decide **whether** to act. Technical accuracy (no fabrication, correct source order) **supports** that outcome; it is not the headline “success” in user-facing terms.

## Return

When answering, make outputs explicit:

- **Set-completion status** — complete / partial / N/A, with **threshold** context (e.g. synergy threshold vs full set).
- **Missing** traits, tags, or set slots (as far as derivable from rules and **known** holdings).
- **schemaVersion** / rule-version notes and **season** / **series** constraints when present.
- **Next actions permitted under deployed contracts and published rules** — e.g. acquiring a token with a missing tag; cannot transfer if flags block—framed as **informational options**, not recommendations to “go do it.” Not **legal** or exchange-ToS advice unless the user asks; then defer to qualified counsel / primary sources.
- **Uncertainty** (explicit): version mismatches, incomplete wallet view, indexer vs. authoritative disagreement, ambiguous seasonal windows.
- **Confidence** (high / medium / low) with **evidence pointers** (which contract fields, URI payload, or events were used).

## Canonical evidence (priority order)

Resolve truth in this order; **indexers must not override** higher-priority sources. When an indexer disagrees with authoritative state, **say so** and prefer 1–2.

1. **Contract state** — e.g. `tokenTraits`, `ownerOf`, `series`, `baseURI` from [`contracts/src/LeprechaunNFT.sol`](../../contracts/src/LeprechaunNFT.sol).
2. **tokenURI / resolved JSON** — keys aligned with [`docs/schemas/leprechaun-nft-metadata-v1.schema.json`](../../docs/schemas/leprechaun-nft-metadata-v1.schema.json).
3. **Relevant events** — e.g. `Minted`, `SeriesCreated` (and any future update events if added).
4. **Schema docs** — [`docs/schemas/README.md`](../../docs/schemas/README.md), [`docs/schemas/CHANGELOG.md`](../../docs/schemas/CHANGELOG.md), product doc for interpretation.
5. **Indexers** — only for **caching or discovery**; never as authoritative truth.

## Fields to inspect (machine-readable)

**JSON metadata** (schema): `schemaVersion`, `series`, `traits` (e.g. `role`, `rarityTier`, `passiveEffectType`), `set` (`setId`, `positionInSet`, `setSize`, `synergyThresholdCount`, optional `requiredSiblingTokenIds`), `faction` (`factionId`, `seasonalSeriesId`, `seasonStartUnix`, `seasonEndUnix`), `bonus`, `synergy`, `agentSkills` (including `soulbound`, `metadataMutableByOwner`).
**Contract `Traits`** (same conceptual data may appear): `seriesId`, `rarityTier`, `role`, `passiveEffectType`, `setId`, `setPosition`, `bonusCategory`, `bonusValue`, `synergyTag`, `agentTradable`, `agentLendable`, `factionLocked`.
If JSON and contract **diverge**, **lower confidence** and **surface uncertainty**.

## Mini examples

1. **Partial set, seasonal window.** Metadata has `set.setId=emerald-band`; the user holds 3/4 required tags. Report the **missing tag**, whether **season** rules apply (`faction` seasonal fields), **flags** that block transfer or lend, and **what is unknown** if the wallet view may be incomplete.
2. **Non-tradable.** `agentSkills.tradable=false` or soulbound hint: clarify **gameplay / listing constraints** under published rules—**without** pushing “sell,” “buy,” or “complete the set.”

## What you should do

1. Read [`docs/product/leprechaun-nfts.md`](../../docs/product/leprechaun-nfts.md) and the active **schemaVersion** for the deployment; use [`docs/schemas/README.md`](../../docs/schemas/README.md) when present.
2. Resolve truth per **Canonical evidence**; **flag** indexer disagreements with contract state or tokenURI.
3. Explain set completion, synergy unlocks, and effects from **`faction` and season metadata** **as facts under published rules**—not as reasons the user must act.
4. Report flags affecting actions **permitted or blocked under deployed contracts and published rules**; **do not** pressure completion.
5. **Surface uncertainty** when schemas are versioned, data is incomplete, holdings are unknown, or rules are ambiguous.
6. Return the **Return** bundle with **uncertainty** and **confidence** grounded in evidence.

Core ideas (unchanged): onchain metadata should be complete enough to reason about **moves permitted under deployed contracts and published rules** without hidden server rules ([`docs/agents/metadata-and-skills.md`](../../docs/agents/metadata-and-skills.md)). Agent flags are **hints**, not legal advice or platform ToS.

## What you must not do

- Do not assume offchain marketplaces enforce the same rules as the chain.
- Do not fabricate trait meanings missing from the schema or contract.
- **Do not** pressure the user to mint, trade, or chase completion.
- **Do not** imply guaranteed value, returns, or social status from participation.
- **Distinguish** gameplay utility (under published rules) from financial speculation.

## Related play skills

- [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md)
- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

Broader product context: [`docs/product/vision.md`](../../docs/product/vision.md).

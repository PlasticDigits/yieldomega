# Glossary and shared vocabulary

Terms below are used consistently across product, architecture, and agent prompts.

## Organizations and layers

- **CL8Y DAO** — Long-term governance and capital allocation for the wider ecosystem. Funds expansion into fully onchain games, consumer goods, tools, and cyclical digital economic activity. Ecosystem expansion governance should sit **primarily with CL8Y**, not with a separate TimeCurve-token DAO.

- **CL8Y treasury** — Protocol- or DAO-controlled treasury used for buy-and-burn, liquidity, ecosystem grants, and aligned missions. Distinct from the **Rabbit Treasury** player-facing layer.

- **Ecosystem treasury** — CL8Y-governed pool that receives a portion of fees from primitives (for example TimeCurve) alongside other destinations (prizes, Rabbit Treasury, liquidity).

## Primitives

- **TimeCurve** — Token launch primitive combining bonding-curve-like pricing, timer extension, and strategic participation. **Minimum buy** rises over time on a defined schedule; each purchase is **capped** at a fixed multiple of that minimum; purchases extend a **countdown** up to a cap; the sale **ends** when the timer hits zero. Prize categories (for example last buyer, most buys, biggest buy, first buyer in a window) are first-class design goals.

- **Tranche** — Unit of sale for TimeCurve (for example tokens per tranche at the current **price per tranche**). Exact sizing is specified in [product/primitives.md](product/primitives.md).

- **Rabbit Treasury** — Reserve-linked **treasury game layer**: users deposit reserve assets and hold internal claims whose effective value can adjust based on **reserve health** over rolling periods (for example 24 hours). Designed to avoid brittle “hard rug” dynamics while staying honest that sustainability depends on real fees and usage—not magic yield. **Not** the primary governance treasury.

- **Rabbit NFTs** — Collectibles with **onchain, machine-readable metadata**: gameplay bonuses, sets, factions, synergy tags, and **agent skill flags**. NFTs anchor identity, progression, and team play inside the ecosystem.

## Assets and naming

- **USDm (MegaUSD)** — Native MegaETH stablecoin (informal team shorthand **MUSD** may appear in prompts or chat; documentation should prefer **USDm** where precision matters). Used as a primary reserve and routing asset where the design calls for dollar-stable liquidity. See [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md).

- **Reserve asset** — Asset accepted by Rabbit Treasury (often USDm or other approved stablecoins/tokens per governance). “Reserve health” is defined relative to these assets and onchain accounting rules.

## Gameplay and agents

- **Set** — A defined group of Rabbit NFTs that unlocks synergies when completed or partially completed.

- **Faction / team** — Onchain grouping used for competitive treasury or seasonal play; mechanics should include **comeback** levers so one faction cannot win permanently by early lead alone.

- **Agent skill flags** — Boolean or enumerated fields in **onchain** metadata indicating capabilities or constraints for autonomous agents (for example “tradable,” “stakable,” “faction-locked”). See [agents/metadata-and-skills.md](agents/metadata-and-skills.md).

- **Internal units / claims** — Accounting representation inside Rabbit Treasury (names TBD at implementation time). Not necessarily 1:1 with a fixed offchain promise; repricing rules are onchain.

## Technical

- **MegaETH / MegaEVM** — MegaETH L2; MegaEVM is the execution environment (EVM-compatible with MegaETH-specific gas and limits). See [research/megaeth.md](research/megaeth.md).

- **Indexer** — Rust + Postgres service that follows chain history, decodes events, and serves read-optimized APIs. Not authoritative for game outcomes.

- **Fully onchain** — Critical game and treasury rules are enforced by contracts; offchain components do not decide winners, balances, or fund movements.

---

**Agent phase:** [Phase 1 — Glossary and shared vocabulary](agent-phases.md#phase-1)

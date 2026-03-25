# Glossary and shared vocabulary

Terms below are used consistently across product, architecture, and agent prompts.

## Organizations and layers

- **CL8Y DAO** — Long-term governance and capital allocation for the wider ecosystem. Funds expansion into fully onchain games, consumer goods, tools, and cyclical digital economic activity. Ecosystem expansion governance should sit **primarily with CL8Y**, not with a separate TimeCurve-token DAO.

- **CL8Y treasury** — Protocol- or DAO-controlled treasury used for buy-and-burn, liquidity, ecosystem grants, and aligned missions. Distinct from the **Rabbit Treasury** player-facing layer.

- **Ecosystem treasury** — CL8Y-governed pool for grants, expansion, and aligned missions. It is **not** a line item in the **TimeCurve** canonical fee table ([fee sinks](onchain/fee-routing-and-governance.md#fee-sinks)); it may receive flows from **other** primitives, governance, or allocations outside that table.

## Primitives

- **TimeCurve** — Token launch primitive combining bonding-curve-like pricing, timer extension, and strategic participation. **Minimum buy** rises over time on a defined schedule (canonical **25% per day** target unless governance changes it); each purchase is **capped** at a fixed multiple of that minimum; purchases extend a **countdown** up to a cap; the sale **ends** when the timer hits zero. Each buy is a **spend** in the accepted asset between that minimum and the cap; **allocation** follows the onchain pricing rule. **Prize** categories include **1st, 2nd, 3rd** placements across multiple categories (see [product/primitives.md](product/primitives.md)). Canonical fees route to **DOUB LP**, **Rabbit Treasury**, **prizes**, and **CL8Y buy-and-burn** per [fee sinks](onchain/fee-routing-and-governance.md#fee-sinks) in [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md).

- **Rabbit Treasury** — Reserve-linked **treasury game layer** (also called the **Burrow** in UX): users deposit reserve assets and hold internal claims whose effective value can adjust based on **reserve health** over rolling periods (for example 24 hours). Designed to avoid brittle “hard rug” dynamics while staying honest that sustainability depends on real fees and usage—not magic yield. **Not** the primary governance treasury.

- **Leprechaun NFTs** — Collectibles with **onchain, machine-readable metadata**: gameplay bonuses, sets, factions, synergy tags, and **agent skill flags**. NFTs anchor identity, progression, and team play inside the ecosystem.

## Assets and naming

- **USDm (MegaUSD)** — Native MegaETH stablecoin. **Documentation uses USDm only** (do not use alternate spellings). Used as a primary reserve and routing asset where the design calls for dollar-stable liquidity. See [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md).

- **Reserve asset** — Asset accepted by Rabbit Treasury (often USDm or other approved stablecoins/tokens per governance). “Reserve health” is defined relative to these assets and onchain accounting rules.

## Gameplay and agents

- **Set** — A defined group of Leprechaun NFTs that unlocks synergies when completed or partially completed.

- **Faction / team** — Onchain grouping used for competitive treasury or seasonal play; mechanics should include **comeback** levers so one faction cannot win permanently by early lead alone.

- **Agent skill flags** — Boolean or enumerated fields in **onchain** metadata indicating capabilities or constraints for autonomous agents (for example “tradable,” “stakable,” “faction-locked”). See [agents/metadata-and-skills.md](agents/metadata-and-skills.md).

- **Doubloons (DOUB)** — Fungible receipt token for Rabbit Treasury (**Burrow**) deposits: internal accounting and repricing rules are **onchain**; not a bank deposit or fixed offchain promise.

- **Referral code** — Short alphanumeric string registered onchain via **`ReferralRegistry`** by burning **CL8Y**; used on **`TimeCurve`** buys to attribute **referrer** and **referee** rewards per [product/referrals.md](product/referrals.md). Distinct from the **CL8Y protocol treasury** sink.

## Technical

- **MegaETH / MegaEVM** — MegaETH L2; MegaEVM is the execution environment (EVM-compatible with MegaETH-specific gas and limits). See [research/megaeth.md](research/megaeth.md).

- **Indexer** — Rust + Postgres service that follows chain history, decodes events, and serves read-optimized APIs. Not authoritative for game outcomes.

- **Fully onchain** — Critical game and treasury rules are enforced by contracts; offchain components do not decide winners, balances, or fund movements.

---

**Agent phase:** [Phase 1 — Glossary and shared vocabulary](agent-phases.md#phase-1)

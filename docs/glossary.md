# Glossary and shared vocabulary

Terms below are used consistently across product, architecture, and agent prompts.

## Organizations and layers

- **CL8Y DAO** — Long-term governance and capital allocation for the wider ecosystem. Funds expansion into fully onchain games, consumer goods, tools, and cyclical digital economic activity. Ecosystem expansion governance should sit **primarily with CL8Y**, not with a separate TimeCurve-token DAO.

- **CL8Y treasury** — Protocol- or DAO-controlled treasury used for liquidity programs, ecosystem grants, burns where policy requires, and aligned missions. Distinct from the **Rabbit Treasury** player-facing layer.

- **Ecosystem treasury** — CL8Y-governed pool for grants, expansion, and aligned missions. It is **not** a line item in the **TimeCurve** canonical fee table ([fee sinks](onchain/fee-routing-and-governance.md#fee-sinks)); it may receive flows from **other** primitives, governance, or allocations outside that table.

## Primitives

- **TimeCurve** — Token launch primitive combining bonding-curve-like pricing, timer extension, and strategic participation. **Minimum buy** (charm price floor) rises over time on a defined schedule (canonical **20% per day** exponential envelope on the reference unless governance changes it); each purchase is **capped** at **10×** the nominal minimum CHARM at the same scale; purchases extend a **countdown** (or **hard-reset** remaining time toward **15 minutes** when under **13 minutes** left) up to a cap; the sale **ends** when the timer hits zero. Buys add **CHARM weight** (including referral bonuses); after the sale, **`redeemCharms`** converts CHARM into launched **DOUB** pro-rata to **`totalCharmWeight`**. **Reserve podium** payouts (accepted asset) come from **`PodiumPool`** after `endSale` across **four** categories — **last buy**, **WarBow** (top Battle Points), **defended streak**, **time booster** — see [primitives](product/primitives.md). **WarBow** combines **Battle Points** PvP scoring (steal, guard, revenge, flag claim, streak-break bonuses) with a **reserve-funded** top-3 slice from the podium pool. Canonical **TimeCurve** fee routing (of gross spend in the accepted asset): **DOUB/CL8Y locked LP** 30% · **CL8Y burned** 40% · **podium pool** 20% · **team sink** 0% (reserved) · **Rabbit Treasury** 10% — [fee routing](onchain/fee-routing-and-governance.md#fee-sinks).

- **Rabbit Treasury** — Reserve-linked **treasury game layer** (also called the **Burrow** in UX): users deposit reserve assets and hold internal claims whose effective value can adjust based on **reserve health** over rolling periods (for example 24 hours). Designed to avoid brittle “hard rug” dynamics while staying honest that sustainability depends on real fees and usage—not magic yield. **Not** the primary governance treasury.

- **Leprechaun NFTs** — Collectibles with **onchain, machine-readable metadata**: gameplay bonuses, sets, factions, synergy tags, and **agent skill flags**. NFTs anchor identity, progression, and team play inside the ecosystem. **Offchain** images / JSON reached via `tokenURI` use an **admin-configurable** `baseURI` prefix (`setBaseURI`); **onchain** `tokenTraits` stay the gameplay authority unless minted otherwise ([`leprechaun-nfts.md`](product/leprechaun-nfts.md#metadata-uri-trust-model-onchain-traits-vs-offchain-json)).

## Assets and naming

- **USDm (MegaUSD)** — Native MegaETH stablecoin (see [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md)). **Not** the default **TimeCurve** / **Rabbit Treasury** reserve in the current canonical design — that role is **CL8Y**.

- **CL8Y (reserve role)** — **Canonical accepted asset** for **TimeCurve** buys and **Rabbit Treasury** (Burrow) deposits/withdrawals at launch: the same **CL8Y** ERC-20 used for protocol alignment, **`ReferralRegistry`** registration burns, and **`FeeRouter`** routing (including the sale burn slice). Distinct from “CL8Y treasury” as a governance wallet concept.

- **Reserve asset** — Asset vault token for Rabbit Treasury and TimeCurve `acceptedAsset` (**CL8Y** at launch). “Reserve health” is defined relative to this asset and onchain accounting rules unless governance adds a basket.

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

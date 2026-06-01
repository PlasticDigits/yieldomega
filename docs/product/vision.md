# Product vision

## Mission

We are building a **fully onchain MegaETH-native gamefi ecosystem** centered on two flagship primitives, **Time Arena** (Arena v2) and **Rabbit Treasury**, aligned under the existing **CL8Y DAO** and treasury. The goal is **not** another speculative finance app, but a **full-cycle onchain consumer economy** built around games, collectibles, teams, status goods, and digitally native experiences.

The long-term thesis: crypto should move beyond institutional finance, passive speculation, and empty infrastructure toward systems where people **spend for joy, meaning, identity, social status, and participation**.

## Economic loop

- **All parts of the ecosystem generate fees.**
- A portion of fees flows into the **CL8Y treasury**, whose mission is funding new **fully onchain** games, consumer goods, tools, and cyclical digital economic activity.
- **Governance over ecosystem expansion** should sit **primarily with CL8Y**, not with a separate launchpad-token DAO.

## Primitives in one paragraph

- **Time Arena** is the **flagship game primitive**: skill- and timing-forward participation on **`TimeArena`** — DOUB (or Play CRED) buys, four independent podium timers, **40/30/30** vault routing, epoch CRED, XP, and DOUB WarBow. Arena is **always live** when not paused — no sale-end or CHARM redemption gates ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)). Canonical rules: [time-arena.md](time-arena.md) · [arena-v2.md](arena-v2.md). Retired v1 launchpad semantics: [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244).

- **Rabbit Treasury** is the **treasury game layer** that receives ecosystem value and retains users over time. It should be understood as **reserve-linked** with **internal accounting** and **honest repricing** when reserve health weakens—avoiding brittle collapse narratives while admitting sustainability depends on **real usage and fees**.

- **Collectible NFT layer (retired [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241))** was the **collection, progression, identity, and agent layer**: mascot canon, **explicit onchain metadata**, gameplay bonuses, sets, factions, and machine-readable fields for autonomous agents. **Arena v2** does not redeploy this stack.

## Design values

- **Transparent** — rules and fee paths legible onchain; offchain indexers mirror, not decide.
- **Agent-friendly** — schemas and flags are explicit; no “guess the trait” offchain registries as authority.
- **Mission-driven** — optimize for participation and creative expansion funded by CL8Y, not for extraction as the product.

## Non-goals (explicit)

- **Opaque yield marketing** — no pretending unsustainable returns are “risk-free.”
- **Offchain game masters** — no private servers that determine winners or balances.
- **Governance fragmentation** — avoid parallel DAOs that compete with CL8Y for ecosystem direction unless deliberately chosen later with clear rationale.

## Related documents

- Time Arena (Arena v2): [arena-v2.md](arena-v2.md)
- Retired collectible NFT schema: [schemas/archive/](../../schemas/archive/) ([#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241))
- Fees and CL8Y: [onchain/fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md) — [sinks](../onchain/fee-routing-and-governance.md#fee-sinks), [governance](../onchain/fee-routing-and-governance.md#governance-actors), [invariants](../onchain/fee-routing-and-governance.md#post-update-invariants)

---

**Agent phase:** [Phase 5 — Product vision](../agent-phases.md#phase-5)

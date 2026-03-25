# Play skills — agents as participants

These files are for **agents (and humans)** who may **use** onchain **TimeCurve**, **Rabbit Treasury / DOUB**, and **Leprechaun** mechanics where they choose to. They aim to **enable voluntary participation through transparent, auditable rules and reduced dependence on opaque intermediaries**—and to **support informed participation by users and agents who want clear rules, portability, and actions permitted under deployed contracts and published rules.** They are **not** the same as [`.cursor/skills/`](../.cursor/skills/README.md), which targets **contributors** editing the repo.

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate—not onboard, recruit, or optimize others into actions.

**Terminology:** **Actions permitted under deployed contracts and published rules** = mechanics in code and docs, not **law** / **lawful** in a **legal** sense (jurisdiction, sanctions, securities, tax, platform ToS)—see [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) Safety.

**Entry point:** [Phase 20 in `docs/agent-phases.md`](../docs/agent-phases.md#phase-20).

## Index

| Skill | Use when |
|--------|----------|
| [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) | Ethics-and-governance framing: voluntary participation, auditable rules, informed choice before other play skills. |
| [`play-timecurve-doubloon/SKILL.md`](play-timecurve-doubloon/SKILL.md) | Buys, timer, charms, prizes, and how **DOUB** / fee sinks connect. |
| [`play-rabbit-treasury/SKILL.md`](play-rabbit-treasury/SKILL.md) | Deposits, epochs, **Burrow**, withdraws, and reserve-linked behavior. |
| [`collect-leprechaun-sets/SKILL.md`](collect-leprechaun-sets/SKILL.md) | Series, sets, traits, and collecting onchain. |

## Authoritative docs (always cross-check)

- [Product vision](../docs/product/vision.md)
- [TimeCurve primitives](../docs/product/primitives.md)
- [Rabbit Treasury](../docs/product/rabbit-treasury.md)
- [Leprechaun NFTs](../docs/product/leprechaun-nfts.md)
- [Fee routing and governance](../docs/onchain/fee-routing-and-governance.md)
- [Glossary](../docs/glossary.md)

## Using these in Cursor

Copy or symlink a play `SKILL.md` into `.cursor/skills/` if you want the IDE to auto-suggest it, or `@`-reference paths under `skills/` in chat. Play skills are **rooted here** so they stay visible to agents who never open `.cursor/`.

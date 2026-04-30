# Play skills — agents as participants

These files are for **agents (and humans)** who may **use** onchain **TimeCurve**, **Rabbit Treasury / DOUB**, and **Leprechaun** mechanics where they choose to. They aim to **enable voluntary participation through transparent, auditable rules and reduced dependence on opaque intermediaries**—and to **support informed participation by users and agents who want clear rules, portability, and actions permitted under deployed contracts and published rules.** They are **not** the same as [`.cursor/skills/`](../.cursor/skills/README.md), which targets **contributors** editing the repo.

**Hard rule for agents:** Unless the user **explicitly** wants to change this monorepo (**Phase 18**), do **not** propose merge requests or edits under **`frontend/`**, **`contracts/`**, **`indexer/`**, or CI. Contributor work uses [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../.cursor/skills/yieldomega-guardrails/SKILL.md). **Maintainer / QA checklists** moved to [`docs/testing/manual-qa-checklists.md`](../docs/testing/manual-qa-checklists.md) ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)).

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate—not onboard, recruit, or optimize others into actions.

**Terminology:** **Actions permitted under deployed contracts and published rules** = mechanics in code and docs, not **law** / **lawful** in a **legal** sense (jurisdiction, sanctions, securities, tax, platform ToS)—see [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) Safety.

**Entry point:** [Phase 20 in `docs/agent-phases.md`](../docs/agent-phases.md#phase-20). **Contributor** agents editing the codebase use [Phase 18](../docs/agent-phases.md#phase-18) and [`.cursor/skills/`](../.cursor/skills/README.md) — see [Agents: metadata and skills](../docs/agents/metadata-and-skills.md) for how play vs contributor skills fit together.

## Index (six player-facing skills)

| Skill | Use when |
|--------|----------|
| [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) | Ethics-and-governance framing: voluntary participation, auditable rules, informed choice before other play skills. |
| [`script-with-timecurve-local/SKILL.md`](script-with-timecurve-local/SKILL.md) | Author **local** TypeScript or Python scripts vs **deployed** contracts — env hygiene, proxies, reads before writes, timing-sensitive buys (process disclosure only). |
| [`play-timecurve-doubloon/SKILL.md`](play-timecurve-doubloon/SKILL.md) | Buys, timer, charms, **four** fixed v1 reserve podium **categories**, and how **DOUB** / fee sinks connect ([`docs/product/primitives.md`](../docs/product/primitives.md)). |
| [`play-timecurve-warbow/SKILL.md`](play-timecurve-warbow/SKILL.md) | WarBow Ladder PvP: Battle Points, steal / guard / revenge / flag, timer hard-reset band. |
| [`play-rabbit-treasury/SKILL.md`](play-rabbit-treasury/SKILL.md) | Deposits, epochs, **Burrow**, withdraws, and reserve-linked behavior. |
| [`collect-leprechaun-sets/SKILL.md`](collect-leprechaun-sets/SKILL.md) | Series, sets, traits, and collecting onchain. |

## Contributor documentation (QA / harness)

Fork and build workflows, Playwright-Anvil concurrency, indexer offline checks, referral row checklists, and related procedures: **[`docs/testing/manual-qa-checklists.md`](../docs/testing/manual-qa-checklists.md)** plus [`docs/testing/strategy.md`](../docs/testing/strategy.md) · [`docs/testing/e2e-anvil.md`](../docs/testing/e2e-anvil.md) · [`docs/testing/invariants-and-business-logic.md`](../docs/testing/invariants-and-business-logic.md).

## Related reading (protocol + UX)

- [Product vision](../docs/product/vision.md)
- [TimeCurve primitives](../docs/product/primitives.md)
- [Rabbit Treasury](../docs/product/rabbit-treasury.md)
- [Leprechaun NFTs](../docs/product/leprechaun-nfts.md)
- [Fee routing and governance](../docs/onchain/fee-routing-and-governance.md)
- [Final signoff and value movement (onchain gates)](../docs/operations/final-signoff-and-value-movement.md) ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55))
- [Glossary](../docs/glossary.md)
- [Architecture overview](../docs/architecture/overview.md) — onchain truth vs indexer/frontend roles
- [Agents: metadata and skills](../docs/agents/metadata-and-skills.md) — hub for onchain metadata, contributor skills, and this index
- WarBow **pending-flag plant** opt-in ([issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63)); Forge matrix [issue #77](https://gitlab.com/PlasticDigits/yieldomega/-/issues/77) — [`play-timecurve-warbow/SKILL.md`](play-timecurve-warbow/SKILL.md), [invariants test map](../docs/testing/invariants-and-business-logic.md)
- [TimeCurve frontend (Simple / Arena / Protocol)](../docs/frontend/timecurve-views.md); [Kumbaya quote refresh](../docs/frontend/timecurve-views.md#buy-quote-refresh-kumbaya-issue-56) ([issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56))
- [Kumbaya integration](../docs/integrations/kumbaya.md#issue-65-single-tx-router) · [Referrals](../docs/product/referrals.md) · [Wallet connection](../docs/frontend/wallet-connection.md) — see **manual QA** and **invariants** links inside those docs for row-by-row checklists ([GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100))

**Local Anvil / contributor tooling:** UUPS **proxy** addresses for `DeployDev`, not implementation rows ([`docs/testing/anvil-rich-state.md`](../docs/testing/anvil-rich-state.md), [`docs/testing/invariants-and-business-logic.md`](../docs/testing/invariants-and-business-logic.md), [issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)). **`currentCharmBoundsWad`** on degenerate **`initialMinBuy == 0`** ([issue #73](https://gitlab.com/PlasticDigits/yieldomega/-/issues/73)). **MegaETH** bytecode limits vs EIP-170 — [`docs/contracts/foundry-and-megaeth.md`](../docs/contracts/foundry-and-megaeth.md#megaevm-bytecode-limits-and-nested-call-gas) ([issue #72](https://gitlab.com/PlasticDigits/yieldomega/-/issues/72)).

## Using these in Cursor

Copy or symlink a play `SKILL.md` into `.cursor/skills/` if you want the IDE to auto-suggest it, or `@`-reference paths under `skills/` in chat. Play skills are **rooted here** so they stay visible to agents who never open `.cursor/`.

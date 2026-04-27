# Play skills — agents as participants

These files are for **agents (and humans)** who may **use** onchain **TimeCurve**, **Rabbit Treasury / DOUB**, and **Leprechaun** mechanics where they choose to. They aim to **enable voluntary participation through transparent, auditable rules and reduced dependence on opaque intermediaries**—and to **support informed participation by users and agents who want clear rules, portability, and actions permitted under deployed contracts and published rules.** They are **not** the same as [`.cursor/skills/`](../.cursor/skills/README.md), which targets **contributors** editing the repo.

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate—not onboard, recruit, or optimize others into actions.

**Terminology:** **Actions permitted under deployed contracts and published rules** = mechanics in code and docs, not **law** / **lawful** in a **legal** sense (jurisdiction, sanctions, securities, tax, platform ToS)—see [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) Safety.

**Entry point:** [Phase 20 in `docs/agent-phases.md`](../docs/agent-phases.md#phase-20). **Contributor** agents editing the codebase use [Phase 18](../docs/agent-phases.md#phase-18) and [`.cursor/skills/`](../.cursor/skills/README.md) — see [Agents: metadata and skills](../docs/agents/metadata-and-skills.md) for how play vs contributor skills fit together.

## Index

| Skill | Use when |
|--------|----------|
| [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) | Ethics-and-governance framing: voluntary participation, auditable rules, informed choice before other play skills. |
| [`play-timecurve-doubloon/SKILL.md`](play-timecurve-doubloon/SKILL.md) | Buys, timer, charms, **three** reserve podiums, and how **DOUB** / fee sinks connect. |
| [`play-timecurve-warbow/SKILL.md`](play-timecurve-warbow/SKILL.md) | WarBow Ladder PvP: Battle Points, steal / guard / revenge / flag, timer hard-reset band. |
| [`play-rabbit-treasury/SKILL.md`](play-rabbit-treasury/SKILL.md) | Deposits, epochs, **Burrow**, withdraws, and reserve-linked behavior. |
| [`collect-leprechaun-sets/SKILL.md`](collect-leprechaun-sets/SKILL.md) | Series, sets, traits, and collecting onchain. |
| [`verify-yo-referrals-surface/SKILL.md`](verify-yo-referrals-surface/SKILL.md) | `/referrals` visual QA checklist (issue #64): shell, register, share links, `?ref=` — evidence + links to automated specs. |
| [`verify-yo-album-bgm-resume/SKILL.md`](verify-yo-album-bgm-resume/SKILL.md) | Album 1 BGM **track + offset** resume across refresh / tabs (issue #71): dock hydrate, autoplay-blocked path, skip/end semantics, storage throttle. |

## Authoritative docs (always cross-check)

- [Product vision](../docs/product/vision.md)
- [TimeCurve primitives](../docs/product/primitives.md)
- [Rabbit Treasury](../docs/product/rabbit-treasury.md)
- [Leprechaun NFTs](../docs/product/leprechaun-nfts.md)
- [Fee routing and governance](../docs/onchain/fee-routing-and-governance.md)
- [Final signoff and value movement (onchain gates)](../docs/operations/final-signoff-and-value-movement.md) ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55))
- [Glossary](../docs/glossary.md)
- [Architecture overview](../docs/architecture/overview.md) — onchain truth vs indexer/frontend roles
- [Agents: metadata and skills](../docs/agents/metadata-and-skills.md) — hub for onchain metadata, contributor skills, and this index
- [TimeCurve frontend (Simple / Arena / Protocol)](../docs/frontend/timecurve-views.md) — three-view contract; [Kumbaya quote refresh on the Buy CTA](../docs/frontend/timecurve-views.md#buy-quote-refresh-kumbaya-issue-56) ([issue #56](https://gitlab.com/PlasticDigits/yieldomega/-/issues/56))
- [Kumbaya integration — optional single-tx ETH/USDM entry](../docs/integrations/kumbaya.md#issue-65-single-tx-router) via **`TimeCurveBuyRouter`** + **`buyFor`** onchain ([issue #65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65)), **Simple + Arena** `buyViaKumbaya` when `timeCurveBuyRouter` is set ([issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)); indexer read-model for **`BuyViaKumbaya`** + enriched buys API ([issue #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)); contributor test map: [invariants — Kumbaya / single-tx / indexer](../docs/testing/invariants-and-business-logic.md)
- [Referrals program + `/referrals` surface](../docs/product/referrals.md) — [issue #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64) verification checklist; [invariants — Referrals page visual](../docs/testing/invariants-and-business-logic.md#referrals-page-visual-issue-64)
- [EVM wallet connection (WalletConnect project id, SafePal, injected discovery)](../docs/frontend/wallet-connection.md) ([issue #58](https://gitlab.com/PlasticDigits/yieldomega/-/issues/58))
- [Album 1 BGM + SFX + **resume** (localStorage)](../docs/frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68) ([issue #68](https://gitlab.com/PlasticDigits/yieldomega/-/issues/68), [issue #71](https://gitlab.com/PlasticDigits/yieldomega/-/issues/71)); play checklist: [verify-yo-album-bgm-resume](verify-yo-album-bgm-resume/SKILL.md)

**Local Anvil / tooling (contributors):** If you wire scripts or bots to `DeployDev` addresses, use the **ERC1967 proxy** for UUPS cores (`TimeCurve`, `RabbitTreasury`, …), not the implementation row in `run-latest.json` — see [`docs/testing/anvil-rich-state.md`](../docs/testing/anvil-rich-state.md) and [`docs/testing/invariants-and-business-logic.md`](../docs/testing/invariants-and-business-logic.md) ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)). **MegaETH** limits exceed Ethereum **EIP-170** (512 KiB / 536 KiB initcode per [MegaETH spec](https://docs.megaeth.com/spec/megaevm/contract-limits)). Repo Anvil scripts use **`--code-size-limit 0x80000`**; a bare `anvil` still defaults to **0x6000** (~24 KiB) — see [`docs/contracts/foundry-and-megaeth.md`](../docs/contracts/foundry-and-megaeth.md#megaevm-bytecode-limits-and-nested-call-gas) ([issue #72](https://gitlab.com/PlasticDigits/yieldomega/-/issues/72)).

## Using these in Cursor

Copy or symlink a play `SKILL.md` into `.cursor/skills/` if you want the IDE to auto-suggest it, or `@`-reference paths under `skills/` in chat. Play skills are **rooted here** so they stay visible to agents who never open `.cursor/`.

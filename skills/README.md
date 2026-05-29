# Play skills — agents as participants

These files help agents and humans **use** onchain **Time Arena** (Arena v2) mechanics under published rules. They are **not** contributor guardrails — use [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../.cursor/skills/yieldomega-guardrails/SKILL.md) when editing the repo.

**Entry point:** [Phase 20 in `docs/agent-phases.md`](../docs/agent-phases.md#phase-20) · Product spec: [`docs/product/arena-v2.md`](../docs/product/arena-v2.md) · XP/level gas bounds: [GitLab #265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265) · [`INV-TIME-ARENA-XP-GAS`](../docs/testing/invariants-and-business-logic.md)

## Index

| Skill | Use when |
|--------|----------|
| [`play-active-time-arena/SKILL.md`](play-active-time-arena/SKILL.md) | Route by live / paused / expired timer on `TimeArena`. |
| [`play-time-arena-doub/SKILL.md`](play-time-arena-doub/SKILL.md) | DOUB buys, Last Buy timer, podium funding split. |
| [`play-time-arena-warbow/SKILL.md`](play-time-arena-warbow/SKILL.md) | WarBow stub until [GitLab #252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252). |
| [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) | Ethics framing before other play skills. |
| [`script-with-timecurve-local/SKILL.md`](script-with-timecurve-local/SKILL.md) | Local scripts — env hygiene, proxies, Anvil stack (Arena v2 addresses). |

## Retired (Arena v2 epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238))

TimeCurve launchpad playbooks, Rabbit Treasury, Leprechaun collection — removed in GitLab #241–#245.

## Contributor docs

- [`docs/testing/strategy.md`](../docs/testing/strategy.md)
- [`bots/timearena/README.md`](../bots/timearena/README.md)
- [`docs/onchain/fee-routing-and-governance.md`](../docs/onchain/fee-routing-and-governance.md) — DOUB arena split only

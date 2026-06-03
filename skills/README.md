# Play skills — agents as participants

These files help agents and humans **use** onchain **Time Arena** (Arena v2) mechanics under published rules. They are **not** contributor guardrails — use [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../.cursor/skills/yieldomega-guardrails/SKILL.md) when editing the repo.

**Entry point:** [Phase 20 in `docs/agent-phases.md`](../docs/agent-phases.md#phase-20) · Product spec: [`docs/product/arena-v2.md`](../docs/product/arena-v2.md) · XP/level math: [GitLab #250](https://gitlab.com/PlasticDigits/yieldomega/-/issues/250) · [`arenaXpMath.ts`](../frontend/src/lib/arenaXpMath.ts) · Buy-path gas bounds: [GitLab #265](https://gitlab.com/PlasticDigits/yieldomega/-/issues/265) · [`INV-TIME-ARENA-XP`](../docs/testing/invariants-and-business-logic.md) / [`INV-TIME-ARENA-XP-GAS`](../docs/testing/invariants-and-business-logic.md)

## Index

| Skill | Use when |
|--------|----------|
| [`play-active-time-arena/SKILL.md`](play-active-time-arena/SKILL.md) | Route by live / paused / expired timer on `TimeArena`. |
| [`play-time-arena-doub/SKILL.md`](play-time-arena-doub/SKILL.md) | DOUB buys, Last Buy timer, podium funding split; referral flat **5 CRED** per side ([#272](https://gitlab.com/PlasticDigits/yieldomega/-/issues/272)); Play CRED yield/claim ([#248](https://gitlab.com/PlasticDigits/yieldomega/-/issues/248)); optional **`topUpPodiumPools`** ([#261](https://gitlab.com/PlasticDigits/yieldomega/-/issues/261)); vault funding indexer [#267](https://gitlab.com/PlasticDigits/yieldomega/-/issues/267). Participant wallet stats UI: [#258](https://gitlab.com/PlasticDigits/yieldomega/-/issues/258) · global Last Buy epoch on buys [#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278) (`INV-INDEXER-278-LAST-BUY-EPOCH`, `bash scripts/verify-last-buy-epoch-anvil.sh`) · [arena-views § wallet-profile](../docs/frontend/arena-views.md#wallet-profile-modal-gitlab-258). |
| [`play-time-arena-warbow/SKILL.md`](play-time-arena-warbow/SKILL.md) | WarBow stub until [GitLab #252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252). |
| [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) | Ethics framing before other play skills. |
| [`script-with-timearena-local/SKILL.md`](script-with-timearena-local/SKILL.md) | Local scripts — env hygiene, proxies, Anvil stack (Arena v2 addresses). Dev-wallet seed / minter alignment: [e2e-anvil §281](../docs/testing/e2e-anvil.md#anvil-dev-wallet-seed-gitlab-281). |

## Retired (Arena v2 epic [#238](https://gitlab.com/PlasticDigits/yieldomega/-/issues/238))

TimeCurve launchpad playbooks, Rabbit Treasury, collectible NFT layer — removed in GitLab #241–#245.

## Contributor docs

- [`docs/testing/strategy.md`](../docs/testing/strategy.md)
- [`docs/testing/contract-fork-smoke.md`](../docs/testing/contract-fork-smoke.md) — optional MegaETH RPC fork (`TimeArenaForkTest`, [#275](https://gitlab.com/PlasticDigits/yieldomega/-/issues/275)); verify `bash scripts/verify-contract-fork-smoke.sh`
- [`docs/qa/QA-onboarding-gitlab-issue-body.md`](../docs/qa/QA-onboarding-gitlab-issue-body.md) — QA onboarding ([#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274))
- [`docs/testing/invariants-and-business-logic.md` § TimeArena v2](../docs/testing/invariants-and-business-logic.md#timearena-v2-gitlab-260) · [manual QA §260](../docs/testing/manual-qa-checklists.md#manual-qa-issue-260) · [Anvil E2E](../docs/testing/e2e-anvil.md) ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)) · [dev-wallet seed §281](../docs/testing/e2e-anvil.md#anvil-dev-wallet-seed-gitlab-281) ([#281](https://gitlab.com/PlasticDigits/yieldomega/-/issues/281)) · [Anvil E2E reliability §279](../docs/testing/e2e-anvil.md#anvil-e2e-trap-and-mock-cl8y-extract-gitlab-279) ([#279](https://gitlab.com/PlasticDigits/yieldomega/-/issues/279))
- [`bots/timearena/README.md`](../bots/timearena/README.md)
- [`docs/onchain/fee-routing-and-governance.md`](../docs/onchain/fee-routing-and-governance.md) — DOUB arena split only

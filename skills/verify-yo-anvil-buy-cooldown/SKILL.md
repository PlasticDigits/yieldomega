---
name: verify-yo-anvil-buy-cooldown
description: Optional short TimeCurve per-wallet buy cooldown on local DeployDev (GitLab #88). Use when QA needs multiple consecutive buys from one wallet on Anvil without waiting 5 minutes between each.
---

# Verify Anvil buy cooldown override (DeployDev)

**Why:** Default **`DeployDev`** sets **`TimeCurve.buyCooldownSec = 300`**. Manual checklists that need **several buys from the same wallet** (e.g. [#38](https://gitlab.com/PlasticDigits/yieldomega/-/issues/38), [#39](https://gitlab.com/PlasticDigits/yieldomega/-/issues/39), [#82](https://gitlab.com/PlasticDigits/yieldomega/-/issues/82)) are impractical without lowering the initializer argument ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).

## Invariants

1. **Default unchanged:** With no flags, **`buyCooldownSec`** stays **300** on fresh **`DeployDev`**.
2. **Never zero:** Resolver and **`TimeCurve.initialize`** require **`buyCooldownSec > 0`**. **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC=0`** fails **`DeployDev`** before broadcast.
3. **Single source:** Env logic lives only in [`contracts/script/DeployDevBuyCooldown.sol`](../../contracts/script/DeployDevBuyCooldown.sol); Forge coverage in [`DeployDevBuyCooldown.t.sol`](../../contracts/test/DeployDevBuyCooldown.t.sol) (`test_readBuyCooldownSec_env_resolution_matrix`).

## Flags

| Variable | Role |
|----------|------|
| **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** | QA mode: default numeric cooldown becomes **1** s when **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** is unset. |
| **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** | Explicit seconds (**> 0**). Applies in both branches; see [e2e-anvil.md](../../docs/testing/e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) for defaults. |

## Checklist

- [ ] **`cast call <TimeCurveProxy> "buyCooldownSec()(uint256)" --rpc-url …`** returns **300** without flags, or your chosen override after a flagged deploy.
- [ ] After two quick buys from the same wallet (with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`**), second buy succeeds once **`block.timestamp >= nextBuyAllowedAt`** (1 s pacing).
- [ ] Production / unattended CI: **do not** export these flags unless the job intentionally tests short cooldowns.

## Doc map

- [docs/testing/e2e-anvil.md — DeployDev buy cooldown](../../docs/testing/e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88)
- [docs/testing/invariants-and-business-logic.md — DeployDev buy cooldown env](../../docs/testing/invariants-and-business-logic.md#deploydev-buy-cooldown-env-issue-88)
- [docs/product/primitives.md — Per-wallet buy cooldown](../../docs/product/primitives.md)

**Contributor guardrails:** [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) (item **#88**).

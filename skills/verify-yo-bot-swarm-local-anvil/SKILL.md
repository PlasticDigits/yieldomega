---
name: verify-yo-bot-swarm-local-anvil
description: Local Anvil bot swarm + chain time — interval mining and buy-cooldown env for continuous Buy traffic (GitLab #99).
---

# Verify bot swarm local Anvil (GitLab #99)

**Why:** Default **`SKIP_ANVIL_RICH_STATE=1`** turns **`START_BOT_SWARM`** **on**. With **`buyCooldownSec = 300`** and **automine-only** Anvil, **no transactions** while wallets **sleep** meant **no new blocks** ⇒ **`block.timestamp` froze** and bots stalled until something external mined. [GitLab #99](https://gitlab.com/PlasticDigits/yieldomega/-/issues/99).

## Invariants

1. **Local script only:** [`scripts/start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) adds **`anvil --block-time`** only when **it starts** Anvil and **`START_BOT_SWARM=1`**. **`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC`** (default **12**; **`0`** disables interval mining).
2. **Bots unchanged on non-Anvil:** No **`evm_increaseTime`** or similar was added to Python bot code (**issue C not implemented**).
3. **Cooldown opt-in unchanged:** **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** / **`YIELDOMEGA_ANVIL_BUY_COOLDOWN_SEC`** remain the way to shorten per-wallet spacing ([GitLab #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)).
4. **Pre-existing RPC:** If the stack **reuses** a node on **`ANVIL_PORT`**, the script cannot apply **`--block-time`** — operators see a **warning**.

## Checklist

- [ ] Fresh stack: **`SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh`** — startup log mentions **`Anvil interval mining`** (unless **`YIELDOMEGA_ANVIL_BLOCK_TIME_SEC=0`**).
- [ ] With default swarm + default cooldown, wait **~2–5 minutes** after the initial burst: **Recent buys** / indexer **`/v1/timecurve/buys`** should still show **new** rows (chain time advances during sleeps).
- [ ] Optional dense traffic: re-run with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** — note is **not** printed for default-300 case; buys should arrive much more frequently.
- [ ] **`cast block-number`** / **`eth_getBlockByNumber(latest)`** `timestamp`: after **30–60** s idle, timestamps should increase (interval mining).

## Doc map

- [`docs/testing/e2e-anvil.md` — Bot swarm + Anvil chain time](../../docs/testing/e2e-anvil.md#bot-swarm-anvil-chain-time-gitlab-99)
- [`docs/testing/invariants-and-business-logic.md` — § #99](../../docs/testing/invariants-and-business-logic.md#bot-swarm-anvil-interval-mining-issue-99)
- [`bots/timecurve/README.md`](../../bots/timecurve/README.md) — install + swarm

**Contributor guardrails:** [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) (item **#99**).

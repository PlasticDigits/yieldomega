---
name: script-with-timearena-local
description: Author local TypeScript or Python scripts against deployed TimeArena (Arena v2) — reads, env hygiene, CHARM bounds, cooldowns. For players and agents; not for patching yieldomega unless contributor intent is explicit.
---

# Script with TimeArena locally (TS / Python)

**Audience:** **Players** and **agents helping players** — not **contributors** editing `frontend/`, `contracts/`, or `indexer/` unless the user explicitly intends a merge request. **Contributors:** [Phase 18](../../docs/agent-phases.md#phase-18) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

**Hard rule:** Do **not** propose monorepo edits unless the user states **contributor** intent.

## A. Scope

- **TypeScript** (viem, ethers) or **Python** (web3.py) — **local scripts only**.
- **Never** commit secrets.

## B. Environment and addresses

- **RPC URL** and **chain ID** in env; keys via env or hardware only.
- **UUPS proxies:** Call **`TimeArena`**, **`PodiumVaults`**, **`AdminSellVault`**, **`ReferralRegistry`** proxy addresses — not implementation rows in `run-latest.json` ([#61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).
- **Env vars:** `VITE_TIME_ARENA_ADDRESS` (canonical), `VITE_PODIUM_VAULTS_ADDRESS`, `VITE_ADMIN_SELL_VAULT_ADDRESS`, `VITE_REFERRAL_REGISTRY_ADDRESS` ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266) — `VITE_TIMECURVE_ADDRESS` retired).
- Product rules: [`docs/product/time-arena.md`](../../docs/product/time-arena.md) · [`docs/product/arena-v2.md`](../../docs/product/arena-v2.md) · invariant map: [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md#timearena-v2-gitlab-260) ([#263](https://gitlab.com/PlasticDigits/yieldomega/-/issues/263) doc cleanup).

## C. Read-before-write

- **`TimeArena`:** `paused`, podium deadlines, `buyCooldownSec`, `nextBuyAllowedAt(account)`.
- **CHARM band** and **DOUB** spend per [`time-arena.md`](../../docs/product/time-arena.md).
- **Balances / allowances** for DOUB and optional Kumbaya paths ([`docs/integrations/kumbaya.md`](../../docs/integrations/kumbaya.md)).
- **Reference:** [`bots/timearena/README.md`](../../bots/timearena/README.md) — AGPL; study patterns in your own project.
- **Optional RPC fork smoke (contributors):** [`TimeArenaFork.t.sol`](../../contracts/test/TimeArenaFork.t.sol) + [`contract-fork-smoke.md`](../../docs/testing/contract-fork-smoke.md) ([#275](https://gitlab.com/PlasticDigits/yieldomega/-/issues/275)) — verify `bash scripts/verify-contract-fork-smoke.sh`; not required for local Anvil scripts.

## D. Timing-sensitive buys

- **Source of truth:** RPC reads for deadlines and `block.timestamp`, not indexer latency alone.
- Arena is **always-live** except **`paused`** — no v1 `endSale` / redemption gates ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243)).

## E. Referrals

[`docs/product/referrals.md`](../../docs/product/referrals.md).

## F. Safety

[`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md).

## G. Maintainer full stack

[`docs/testing/qa-local-full-stack.md`](../../docs/testing/qa-local-full-stack.md) · [`scripts/start-qa-local-full-stack.sh`](../../scripts/start-qa-local-full-stack.sh) ([#104](https://gitlab.com/PlasticDigits/yieldomega/-/issues/104)).

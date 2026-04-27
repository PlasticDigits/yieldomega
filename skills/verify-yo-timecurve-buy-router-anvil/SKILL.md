---
name: verify-yo-timecurve-buy-router-anvil
description: Anvil fork verification for TimeCurveBuyRouter (GitLab #65 scope, GitLab #78) — quote vs exactOutput, buyViaKumbaya, WarBow opt-in, re-disable — for agents producing PASS evidence on a local stack.
---

# Verify YO `TimeCurveBuyRouter` on Anvil (issues #65 / #78)

Use this when you need a **one-shot PASS** (or a clear `require`) for the **TimeCurveBuyRouter** + **DeployKumbayaAnvilFixtures** checklist. Authoritative invariants: [invariants — issue #78](../../docs/testing/invariants-and-business-logic.md#timecurvebuyrouter-anvil-verification-issue-78), [kumbaya localnet](../../docs/integrations/kumbaya.md#localnet-anvil). **Browser / wallet flows** after **`anvil_increaseTime`**: swap deadlines follow chain time ([#83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83)); this script does **not** replace manual UI checks — see [kumbaya — Option B](../../docs/integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83) if you must use an unwarped stack.

## Preconditions

- **Anvil** on `RPC_URL` (default `http://127.0.0.1:8545`) with **`--code-size-limit 524288`**
- **TimeCurve proxy** in `YIELDOMEGA_TIMECURVE` (or in `contracts/deployments/local-anvil-registry.json` from `start-local-anvil-stack.sh`)
- **Live sale** — `TimeCurve.ended() == false`. Default rich-state stack **ends** the sale; use `SKIP_ANVIL_RICH_STATE=1` with the stack script, a fresh `DeployDev`, or a chain where the sale is still open
- `cast`, `forge`, `jq` on `PATH`
- If **`timeCurveBuyRouter()`** is still **0** (e.g. only `DeployDev` was run), set **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** so the script broadcasts **`DeployKumbayaAnvilFixtures`**

## Command

```bash
export RPC_URL=http://127.0.0.1:8545
# YIELDOMEGA_TIMECURVE=0x...   # optional if local-anvil-registry has TimeCurve
# YIELDOMEGA_DEPLOY_KUMBAYA=1  # only when buy router is zero
bash scripts/verify-timecurve-buy-router-anvil.sh
```

## What the script checks

| Row | Method |
|-----|--------|
| **Router address** / cast | `cast call` + fork test reads `timeCurveBuyRouter` |
| **USDM two-hop** `quoteExactOutput` vs `exactOutput` | `VerifyTimeCurveBuyRouterAnvil.t.sol` (delta ≤ 1 wei) |
| **`buyViaKumbaya` (stable)** | Same test — credits CHARM, WarBow **opt-out** does not set `warbowPendingFlagOwner` |
| **WarBow opt-in** | Second buy (after cooldown warp) — `warbowPendingFlagOwner == buyer` (same intent as `Buy.flagPlanted` for agents) |
| **Re-disable** | `setTimeCurveBuyRouter(0)` then `buyFor` from old router reverts `TimeCurve: not buy router` |

The `Buy` **event** `flagPlanted` is not decoded in the test; onchain **`warbowPendingFlagOwner`** reflects the [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63) opt-in for the same tx sequence.

## Default `forge test` (CI)

Without **`YIELDOMEGA_FORK_VERIFY`**, the fork test **returns early** and **passes** so CI’s **`forge test`** is unchanged.

## Agent phase

[Phase 14 — Testing strategy](../../docs/agent-phases.md#phase-14) for contract/tooling; cross-links from [kumbaya.md](../../docs/integrations/kumbaya.md) and [local-swap-testing.md](../../docs/testing/local-swap-testing.md).

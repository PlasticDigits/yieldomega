---
name: play-time-arena-warbow
description: WarBow PvP on TimeArena — DOUB steals, guard, revenge, flag; epoch BP reset and admin finalize.
---

# Play Time Arena — WarBow

WarBow on **`TimeArena`** spends **DOUB** (not CL8Y). Canonical costs and BP rules: [`docs/product/arena-v2.md` § WarBow](../../docs/product/arena-v2.md#warbow-doub) · [`docs/product/time-arena.md` § WarBow PvP](../../docs/product/time-arena.md) · invariants **`INV-TIME-ARENA-WARBOW-*`** in [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md).

## DOUB costs (18 decimals)

| Action | DOUB |
|--------|------|
| `warbowSteal(victim, payBypassBurn)` | 1000 (+ 50000 if daily steal limit exceeded) |
| `warbowActivateGuard()` | 10000 |
| `warbowRevenge(stealer)` | 1000 |
| `claimWarBowFlag()` | 0 |

## Flow

1. **Earn BP** — each DOUB/CRED buy adds WarBow BP (base + Last Buy timer bonuses; scoring uses **Last Buy** timer only — [#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)).
2. **Steal** — attacker BP &gt; 0; victim BP in **2×–10×** band; drains 10% (1% if guarded).
3. **Guard / revenge / flag** — see [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) constants `WARBOW_*`.
4. **Epoch roll** — permissionless `rollPodiumEpoch(CAT_WARBOW)` after deadline clears live BP/podium; **admin** `finalizeWarbowPodium(epoch, first, second, third)` pays 4∶2∶1 from the WarBow active pool ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252)).

## Frontend (GitLab [#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256))

Participant UI: **`/arena`** → [`ArenaWarbowHeroPanel.tsx`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) (`data-testid="warbow-hero-actions"`). Cost pills read **`WARBOW_STEAL_DOUB`**, **`WARBOW_GUARD_DOUB`**, **`WARBOW_STEAL_LIMIT_BYPASS_DOUB`**, **`WARBOW_REVENGE_DOUB`** from the `TimeArena` proxy. Doc map: [arena-views § unified](../../docs/frontend/arena-views.md#unified-arena-page-gitlab-256) · **`INV-FRONTEND-256-UNIFIED-ARENA`**.

## Local stack

Same as [`play-time-arena-doub`](../play-time-arena-doub/SKILL.md): Anvil **`http://127.0.0.1:8545`**, approve DOUB to **`TimeArena`**, `VITE_TIME_ARENA_ADDRESS`. Indexer WarBow feeds: **`GET /v1/arena/warbow/*`** ([`docs/indexer/design.md`](../../docs/indexer/design.md)).

## Bots

[`bots/timearena/`](../../bots/timearena/README.md) PvP strategy: `strategies/pvp.py` — retarget to deployed `TimeArena` proxy ABI.

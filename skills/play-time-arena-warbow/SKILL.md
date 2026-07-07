---
name: play-time-arena-warbow
description: WarBow PvP on TimeArena — DOUB steals, guard, revenge, flag; epoch BP reset and on-chain autoroll payout.
---

# Play Time Arena — WarBow

WarBow on **`TimeArena`** spends **DOUB** (not CL8Y). Canonical costs and BP rules: [`docs/product/arena-v2.md` § WarBow](../../docs/product/arena-v2.md#warbow-doub) · [`docs/product/time-arena.md` § WarBow PvP](../../docs/product/time-arena.md) · invariants **`INV-TIME-ARENA-WARBOW-*`**, **`INV-TIME-ARENA-PAUSE-MUTATING`**, **`INV-TIME-ARENA-WARBOW-REVERT-MATRIX`** in [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md) ([#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316)).

## DOUB costs (18 decimals)

| Action | DOUB | Prize routing |
|--------|------|----------------|
| `warbowSteal(victim, payBypassBurn)` | 1000 (+ 50000 if daily steal limit exceeded) | 100% podiums via `_routeDoubPrizeSplit`; bumps `totalDoubRaised` ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) |
| `warbowActivateGuard()` | 10000 | same |
| `warbowRevenge(stealer)` | 1000 | same |
| `claimWarBowFlag()` | 0 | n/a |

## Flow

1. **Earn BP** — each DOUB/CRED buy adds WarBow BP (base + Last Buy timer bonuses + **streak-break** + **ambush** when qualifying ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)); scoring uses **Last Buy** timer only — [#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)).
2. **Steal** — attacker BP &gt; 0; victim BP in **2×–10×** band; drains 10% (1% if guarded).
3. **Guard / revenge / flag** — see [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) constants `WARBOW_*`.
4. **Epoch roll / autoroll** — when the WarBow timer expires, **`rollPodiumEpoch(CAT_WARBOW)`** or any buy/WarBow action autorolls: pays on-chain top-3 **4∶2∶1**, emits **`WarbowPodiumFinalized`**, clears live BP ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252), [#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)). Admin **`finalizeWarbowPodium`** is superseded.

## Frontend (GitLab [#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256))

Participant UI: **`/`** → [`ArenaWarbowHeroPanel.tsx`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) (`data-testid="warbow-hero-actions"`). The **viewer summary** card (`data-testid="warbow-hero-viewer-summary"`) shows YOUR BP, GUARD, **STEAL QUOTA** (`X/3` + UTC-day reset countdown — [#361](https://gitlab.com/PlasticDigits/yieldomega/-/issues/361) · **`INV-FRONTEND-361-WARBOW-STEAL-QUOTA-UX`**), and — when you hold a planted flag — **`FLAG:`** silence countdown or **claim now** beside BP ([#362](https://gitlab.com/PlasticDigits/yieldomega/-/issues/362) · **`INV-FRONTEND-362-WARBOW-VIEWER-SUMMARY-FLAG`** · [arena-views §362](../../docs/frontend/arena-views.md#warbow-viewer-summary-flag-gitlab-362)). Inline **`describeStealPreflight`** warns in the steal card before submit when daily caps apply. Cost pills read **`WARBOW_STEAL_DOUB`**, **`WARBOW_GUARD_DOUB`**, **`WARBOW_STEAL_LIMIT_BYPASS_DOUB`**, **`WARBOW_REVENGE_DOUB`** from the `TimeArena` proxy. Doc map: [arena-views § unified](../../docs/frontend/arena-views.md#unified-arena-page-gitlab-256) · **`INV-FRONTEND-256-UNIFIED-ARENA`**.

## Local stack

Same as [`play-time-arena-doub`](../play-time-arena-doub/SKILL.md): Anvil **`http://127.0.0.1:8545`**, approve DOUB to **`TimeArena`**, `VITE_TIME_ARENA_ADDRESS`. Indexer WarBow feeds: **`GET /v1/arena/warbow/*`** ([`docs/indexer/design.md`](../../docs/indexer/design.md)).

## Bots

[`bots/timearena/`](../../bots/timearena/README.md) PvP strategy: `strategies/pvp.py` — retarget to deployed `TimeArena` proxy ABI.

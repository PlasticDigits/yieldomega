---
name: play-time-arena-warbow
description: WarBow PvP on TimeArena — DOUB steals, guard, revenge, flag; epoch BP reset and on-chain autoroll payout.
---

# Play Time Arena — WarBow

WarBow on **`TimeArena`** spends **DOUB** (not CL8Y). Canonical costs and BP rules: [`docs/product/arena-v2.md` § WarBow](../../docs/product/arena-v2.md#warbow-doub) · [`docs/product/time-arena.md` § WarBow PvP](../../docs/product/time-arena.md) · invariants **`INV-TIME-ARENA-WARBOW-DOUB`**, **`INV-TIME-ARENA-WARBOW-STEAL-BAND`**, **`INV-TIME-ARENA-PAUSE-MUTATING`**, **`INV-TIME-ARENA-WARBOW-REVERT-MATRIX`** in [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md) ([#316](https://gitlab.com/PlasticDigits/yieldomega/-/issues/316), [#366](https://gitlab.com/PlasticDigits/yieldomega/-/issues/366), [#367](https://gitlab.com/PlasticDigits/yieldomega/-/issues/367)).

## DOUB costs (18 decimals)

| Action | DOUB | Prize routing |
|--------|------|----------------|
| `warbowSteal(victim, payBypassBurn)` | `epochCharmAnchor / 5` (+ fixed 50000 if daily steal limit exceeded) | 100% podiums via `_routeDoubPrizeSplit`; bumps `totalDoubRaised` ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)) |
| `warbowActivateGuard()` | `epochCharmAnchor / 2` | same |
| `warbowRevenge(stealer)` | `epochCharmAnchor / 5` | same |
| `claimWarBowFlag()` | 0 | n/a |

Steal, guard, and revenge use the epoch charm anchor after autoroll, never the +10%/day buy-price growth. Read `WARBOW_*_DOUB()` immediately before submitting: an autoroll can re-anchor the epoch and re-quote the action price ([#367](https://gitlab.com/PlasticDigits/yieldomega/-/issues/367)).

## Flow

1. **Earn BP** — each DOUB/CRED buy adds WarBow BP (base + Last Buy timer bonuses + **streak-break** + **ambush** when qualifying ([#310](https://gitlab.com/PlasticDigits/yieldomega/-/issues/310)); scoring uses **Last Buy** timer only — [#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)).
2. **Steal** — attacker BP &gt; 0; victim BP in inclusive **1×–50×** band (`attackerBP ≤ victimBP ≤ 50 × attackerBP`); equal-BP steals are allowed, and a higher-BP attacker cannot target a lower-BP wallet ([#366](https://gitlab.com/PlasticDigits/yieldomega/-/issues/366)). Drains 10% (1% if guarded).
3. **Guard / revenge / flag** — see [`TimeArena.sol`](../../contracts/src/arena/TimeArena.sol) constants `WARBOW_*`.
4. **Epoch roll / autoroll** — when the WarBow timer expires, **`rollPodiumEpoch(CAT_WARBOW)`** or any buy/WarBow action autorolls: pays on-chain top-3 **4∶2∶1**, emits **`WarbowPodiumFinalized`**, clears live BP ([#252](https://gitlab.com/PlasticDigits/yieldomega/-/issues/252), [#312](https://gitlab.com/PlasticDigits/yieldomega/-/issues/312)). Admin **`finalizeWarbowPodium`** is superseded.

## Frontend (GitLab [#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256))

Participant UI: **`/`** → [`ArenaWarbowHeroPanel.tsx`](../../frontend/src/pages/arena/ArenaWarbowHeroPanel.tsx) (`data-testid="warbow-hero-actions"`). The **viewer summary** card (`data-testid="warbow-hero-viewer-summary"`) shows YOUR BP, GUARD, **STEAL QUOTA** (`X/3` + UTC-day reset countdown — [#361](https://gitlab.com/PlasticDigits/yieldomega/-/issues/361) · **`INV-FRONTEND-361-WARBOW-STEAL-QUOTA-UX`**), and — when you hold a planted flag — **`FLAG:`** silence countdown or **claim now** ([#362](https://gitlab.com/PlasticDigits/yieldomega/-/issues/362) · **`INV-FRONTEND-362-WARBOW-VIEWER-SUMMARY-FLAG`** · [arena-views §362](../../docs/frontend/arena-views.md#warbow-viewer-summary-flag-gitlab-362)). Steal card shows **`describeStealPreflight`** above **Steal** before submit ([#361](https://gitlab.com/PlasticDigits/yieldomega/-/issues/361)). Cost pills read live **`WARBOW_STEAL_DOUB()`**, **`WARBOW_GUARD_DOUB()`**, **`WARBOW_STEAL_LIMIT_BYPASS_DOUB`**, **`WARBOW_REVENGE_DOUB()`** from the `TimeArena` proxy; at the `1000e18` Dev/Anvil anchor they show 200 / 500 / 50000 / 200 DOUB ([#367](https://gitlab.com/PlasticDigits/yieldomega/-/issues/367)). Doc map: [arena-views § unified](../../docs/frontend/arena-views.md#unified-arena-page-gitlab-256) · **`INV-FRONTEND-256-UNIFIED-ARENA`**.

## Local stack

Same as [`play-time-arena-doub`](../play-time-arena-doub/SKILL.md): Anvil **`http://127.0.0.1:8545`**, approve DOUB to **`TimeArena`**, `VITE_TIME_ARENA_ADDRESS`. Indexer WarBow feeds: **`GET /v1/arena/warbow/*`** ([`docs/indexer/design.md`](../../docs/indexer/design.md)).

## Bots

[`bots/timearena/`](../../bots/timearena/README.md) PvP strategy: `strategies/pvp.py` — retarget to deployed `TimeArena` proxy ABI.

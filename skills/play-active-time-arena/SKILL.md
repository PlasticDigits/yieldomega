---
name: play-active-time-arena
description: Route agents to the right TimeArena playbook from onchain paused/live state.
---

# Play active Time Arena

1. Read **`TimeArena.paused()`** and **`deadline()`** vs `block.timestamp`.
2. If **paused** → do not submit buys; surface governance status.
3. If **timer expired** (`block.timestamp > deadline`) → arena round needs operator attention or a new epoch (no `endSale` / redeem flow).
4. If **live** → use [`play-time-arena-doub/SKILL.md`](play-time-arena-doub/SKILL.md).
5. WarBow → [`play-time-arena-warbow/SKILL.md`](play-time-arena-warbow/SKILL.md) (stub until #252).

Indexer: when `VITE_INDEXER_URL` is set, use Arena v2 HTTP **`GET /v1/arena/timers`**, **`/v1/arena/podiums`**, **`/v1/arena/buys`**, and **`GET /v1/arena/wallet/{address}/stats`** ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254), [#255](https://gitlab.com/PlasticDigits/yieldomega/-/issues/255)). **`/v1/arena/podiums`** returns UX-ordered live leaders from Postgres (**`podium_prediction: true`**) per [#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273) — do not rely on head `podium(3)` alone for WarBow mid-epoch. Retired TimeCurve v1 routes (`/v1/timecurve/*`, legacy WarBow leaderboard HTTP) — [#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266).

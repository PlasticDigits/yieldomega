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

Indexer: when `VITE_INDEXER_URL` is set, use **`GET /v1/arena/timers`** (deadline, total DOUB raised, paused) and **`GET /v1/arena/buys`** — legacy **`/v1/arena/*`** HTTP was removed ([#266](https://gitlab.com/PlasticDigits/yieldomega/-/issues/266), [#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)).

---
name: play-timecurve-warbow
description: WarBow Ladder PvP on TimeCurve — Battle Points, steals, guard, revenge, flag, timer hard-reset band, and UTC-day steal caps. Use when helping a human act on WarBow or interpret BP feeds—not when editing Solidity.
---

# Play WarBow Ladder (TimeCurve PvP)

## Scope

You are helping a **participant** use **WarBow** mechanics on **TimeCurve**: **Battle Points (BP)** on a separate ladder from the **three reserve podium** categories (last buy, time booster, defended streak). Read [`docs/product/primitives.md`](../../docs/product/primitives.md) (WarBow + timer sections) and verify **live** `TimeCurve` on the target chain.

**Agent role:** Explain options, costs (including CL8Y burns), windows, and tie-breaks so the user can choose whether to act.

## Truth order

1. **Deployed `TimeCurve`** — `battlePoints`, `warbowLadderPodium`, `warbowPendingFlagOwner`, `warbowPendingFlagPlantAt`, `warbowPendingRevengeStealer`, `warbowPendingRevengeExpiry`, `warbowGuardUntil`, `stealsReceivedOnDay`, constants `WARBOW_*`, `TIMER_RESET_*`, `DEFENDED_STREAK_WINDOW_SEC`.
2. **Events** — `Buy` (BP line items, `hardReset`, streak fields), `WarBowSteal`, `WarBowRevenge`, `WarBowGuardActivated`, `WarBowFlagClaimed`, `WarBowFlagPenalized`, `WarBowCl8yBurned`, defended-streak events.
3. **Product docs** — [`docs/product/primitives.md`](../../docs/product/primitives.md).
4. **Indexer / frontend** — discovery and history; **do not** override chain for eligibility or balances.

## Core rules (participant-facing)

- **Timer:** Each qualifying buy either **extends** the sale end by the configured extension **or**, if **remaining time before the buy** is **strictly below 13 minutes**, performs a **hard reset** so remaining snaps toward **15 minutes** (still capped by the global timer cap). See onchain `TimeMath.extendDeadlineOrResetBelowThreshold`.
- **BP from buys (summary):** Base BP per buy (`WARBOW_BASE_BUY_BP`), extra BP on hard reset (`WARBOW_TIMER_RESET_BONUS_BP`), **clutch** if remaining before buy is **strictly below 30 seconds**, **streak-break** BP when you end another wallet’s **active** defended streak under the **15-minute** window, plus **ambush** BP when that break coincides with a **hard reset**. Exact numbers are onchain constants.
- **Defended streak (prize category + WarBow context):** Under **15 minutes** remaining, streak logic and **best** streak for the podium are onchain; WarBow uses **active** streak of the **last buyer under the window** for break/ambush calculations (see primitives).
- **Steal:** Burns CL8Y; drains a **floor** fraction of the victim’s BP; **2× rule** vs the stealer’s BP; **per-victim UTC-day** cap unless a larger CL8Y bypass is paid; sets **revenge** state for the victim.
- **Revenge:** Within the onchain window, burn CL8Y to take BP back from the pending stealer (see contract).
- **Guard:** Burn CL8Y for a timed guard that reduces steal drain rate (see `WARBOW_STEAL_DRAIN_*_BPS`).
- **Flag:** After your buy, a **silence** window must pass with **no other buyer**; then you may claim **flag BP**. If another buyer purchases **after** silence elapses before you claim, the pending flag can be **invalidated** and a **penalty** applied to your BP per onchain rules. An interrupt **during** silence clears the flag **without** that penalty.

## UTC day boundary for steals

Steal limits keyed to **`block.timestamp / 86400`** (UTC day index). When advising “how many steals left,” use the user’s chain’s latest block timestamp and onchain `stealsReceivedOnDay(victim, dayId)`.

## Tie-break (WarBow podium)

If two addresses have equal BP on the WarBow ladder podium, **lower `uint160(address)` ranks higher** (onchain ordering).

## What you must not do

- Do not treat **indexer** summaries as authoritative for **revenge / flag / guard** eligibility if they disagree with RPC.
- Do not promise outcomes; disclose MEV, reorgs, and clock skew on “windows.”
- Do not equate **onchain-permitted actions** with **lawful** in every jurisdiction — see [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md).

## Related play skills

- [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md) — sale, timer, CHARM, **three** reserve podiums, fee routing.
- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

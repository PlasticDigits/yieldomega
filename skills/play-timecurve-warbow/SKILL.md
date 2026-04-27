---
name: play-timecurve-warbow
description: WarBow Ladder PvP on TimeCurve — Battle Points, steals, guard, revenge, flag, timer hard-reset band, and UTC-day steal caps. Use when helping a human act on WarBow or interpret BP feeds—not when editing Solidity.
---

# Play WarBow Ladder (TimeCurve PvP)

## Scope

You are helping a **participant** use **WarBow** mechanics on **TimeCurve**: **Battle Points (BP)** — a **PvP score** that can go up or down (buys, steals, flag claim, penalties). The **top-3 BP** snapshot (**`warbowLadderPodium()`**, same as **`podium(CAT_WARBOW)`**) is one of **four** reserve-funded podium categories paid from **`PodiumPool`** after `endSale`. Read [`docs/product/primitives.md`](../../docs/product/primitives.md) (WarBow + timer sections) and verify **live** `TimeCurve` on the target chain.

**Agent role:** Explain options, costs (including CL8Y burns), windows, and tie-breaks so the user can choose whether to act.

## Truth order

1. **Deployed `TimeCurve`** — `battlePoints`, `warbowLadderPodium`, `warbowPendingFlagOwner`, `warbowPendingFlagPlantAt`, `warbowPendingRevengeStealer`, `warbowPendingRevengeExpiry`, `warbowGuardUntil`, `stealsReceivedOnDay`, **`buyFeeRoutingEnabled`** (issue #55: if **false**, **steal / revenge / guard** revert before CL8Y moves; **not** `claimWarBowFlag`), constants `WARBOW_*`, `TIMER_RESET_*`, `DEFENDED_STREAK_WINDOW_SEC`.
2. **Events** — `Buy` (BP line items, `hardReset`, streak fields; **`flagPlanted` is `true` iff that buy opted into planting** the WarBow pending flag — [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63); it is **not** alone proof of who **currently** holds the flag), `WarBowSteal`, `WarBowRevenge`, `WarBowGuardActivated`, `WarBowFlagClaimed`, `WarBowFlagPenalized`, `WarBowCl8yBurned`, defended-streak events.
3. **Product docs** — [`docs/product/primitives.md`](../../docs/product/primitives.md).
4. **Indexer / frontend** — discovery and history; **do not** override chain for eligibility or balances.

## Core rules (participant-facing)

- **Timer:** Each qualifying buy either **extends** the sale end by the configured extension **or**, if **remaining time before the buy** is **strictly below 13 minutes**, performs a **hard reset** so remaining snaps toward **15 minutes** (still capped by the global timer cap). See onchain `TimeMath.extendDeadlineOrResetBelowThreshold`.
- **BP from buys:** Base, hard-reset bonus, **clutch** (remaining before buy **&lt; 30s**), **streak-break**, **ambush** (hard reset plus streak-break in same tx)—see **Documented defaults**; verify `WARBOW_*` on deployment.
- **Defended streak (prize category + WarBow context):** Under **15 minutes** remaining, streak logic and **best** streak for the podium are onchain; WarBow uses **active** streak of the **last buyer under the window** for break/ambush calculations (see primitives).
- **Steal:** Burns **1e18** CL8Y (`WARBOW_STEAL_BURN_WAD`); moves **10%** of victim BP to attacker by default, **1%** if victim is **guarded** (`warbowGuardUntil`); **2× rule:** victim BP **≥ 2×** attacker BP. **Per-victim UTC-day** cap: **3** normal steals; **4th+** same day needs **50e18** CL8Y bypass burn unless documented otherwise — verify constants. Sets **revenge** state (**24h** window for victim vs last stealer).
- **Revenge:** Victim burns **1e18** CL8Y; takes **10%** of stealer BP once; clears pending slot (see contract).
- **Guard:** Burn **10e18** CL8Y; extends guard until **`max(existing, now + 6 hours)`**, reducing steal drain to the **1%** branch while active (see `WARBOW_STEAL_DRAIN_*_BPS`).
- **Flag:** Only **opt-in** buys (or router calls with **`plantWarBowFlag`**) set the **global** pending slot to **you** (`warbowPendingFlagOwner` / `warbowPendingFlagPlantAt`). Plain **`buy(charmWad)`** does **not** plant. After **`WARBOW_FLAG_SILENCE_SEC` (300s)** with **no other buyer** in between, you may **`claimWarBowFlag`** for **`WARBOW_FLAG_CLAIM_BP` (1000)** BP. If **another buyer purchases before you claim**, the pending flag is **cleared** (interrupt logic runs even when that buyer’s tx did **not** plant). The **2× flag-claim BP penalty** applies **only** if that intervening buy occurs **at or after** `plantAt + 300s` (claim was already possible); if the interrupt happens **earlier**, you lose the claim **without** that penalty. An interrupt **during** the silence window clears the flag **without** the 2× penalty (see [`docs/product/primitives.md`](../../docs/product/primitives.md)). **Do not** infer the **current** holder from indexer **`flag_planted`** alone — read **`warbowPendingFlag*`** onchain ([GitLab #51](https://gitlab.com/PlasticDigits/yieldomega/-/issues/51), [GitLab #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63), [`docs/frontend/timecurve-views.md`](../../docs/frontend/timecurve-views.md#warbow-pending-flag-ui-issues-51-63)).

### Documented defaults (verify `TimeCurve` bytecode)

| BP component | Default (BP) | Notes |
|--------------|-------------|--------|
| Base qualifying buy | **250** | `WARBOW_BASE_BUY_BP` |
| Timer hard-reset bonus | **500** | When `timerHardReset` (remaining was &lt; 13m before buy) |
| Clutch timing | **150** | Remaining before buy **&lt; 30s** |
| Streak-break | **`priorActiveStreak × 100`** | Breaks another wallet’s **active** defended streak under the 15m window |
| Ambush (same tx) | **200** | Hard reset **and** streak-break bonus &gt; 0 |

Steals, revenges, guard, and non-buy flag claims **move BP**; ladder ordering is by **total BP** (higher first); see tie-break below.

## UTC day boundary for steals

Steal limits keyed to **`block.timestamp / 86400`** (UTC day index). When advising “how many steals left,” use the user’s chain’s latest block timestamp and onchain `stealsReceivedOnDay(victim, dayId)`.

## Tie-break (WarBow ladder top-3)

Higher **BP** ranks above. If two addresses have **equal** BP on the WarBow ladder snapshot, **lower `uint160(address)` ranks higher** (deterministic onchain ordering; see [`docs/product/primitives.md`](../../docs/product/primitives.md)).

## What you must not do

- Do not treat **indexer** summaries as authoritative for **revenge / flag / guard** eligibility if they disagree with RPC.
- Do not promise outcomes; disclose MEV, reorgs, and clock skew on “windows.”
- Do not equate **onchain-permitted actions** with **lawful** in every jurisdiction — see [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md).

## Contributor / audit cross-links (issue #70)

- **CL8Y burn invariants (fuzz):** each successful **`warbowActivateGuard`**, **`warbowSteal`** (no bypass), and **`warbowRevenge`** moves the documented **fixed WAD** from the payer to the **burn sink** (`0x…dEaD`) in one tx — see [`TimeCurveWarBowCl8yBurns.t.sol`](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) and [invariants — WarBow CL8Y burns](../../docs/testing/invariants-and-business-logic.md#timecurve-warbow-cl8y-burns-issue-70).
- **Policy context:** [CL8Y flow audit](../../docs/onchain/cl8y-flow-audit.md) (approved **user-driven** exception for these burns).

## Related play skills

- [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md) — sale, timer, CHARM, **three** reserve podiums, fee routing.
- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

---
name: play-timecurve-warbow
description: WarBow Ladder PvP on TimeCurve — Battle Points, steals, guard, revenge, flag, timer hard-reset band, and UTC-day steal caps. Use when helping a human act on WarBow or interpret BP feeds—not when editing Solidity.
---

# Play WarBow Ladder (TimeCurve PvP)

## Scope

**Audience:** **Players** and **agents assisting players** — **not** contributors editing this monorepo unless the user explicitly wants **Phase 18** / guardrails work.

You are helping a **participant** use **WarBow** mechanics on **TimeCurve**: **Battle Points (BP)** — a **PvP score** that can go up or down (buys, steals, flag claim, penalties). The **top-3 BP** snapshot (**`warbowLadderPodium()`**, same as **`podium(CAT_WARBOW)`**) is one of **four** reserve-funded podium categories paid from **`PodiumPool`** after `endSale`. Read [`docs/product/primitives.md`](../../docs/product/primitives.md) (WarBow + timer sections) and verify **live** `TimeCurve` on the target chain.

**Hard rule:** Do **not** propose merge requests or patches under `frontend/`, `contracts/`, `indexer/`, or CI — redirect contributors to [Phase 18](../../docs/agent-phases.md#phase-18) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

**Agent role:** Explain options, costs (including CL8Y burns), windows, and tie-breaks so the user can choose whether to act.

### Optional local automation

For participant-owned **TS / Python** tooling (reads, submits, WarBow-related calls) against **deployed** `TimeCurve`, see [`script-with-timecurve-local/SKILL.md`](../script-with-timecurve-local/SKILL.md).

**YieldOmega web wallet UX:** Steal / guard / revenge pull CL8Y through **`TimeCurve`** with the same **`approve`** pattern as **`buy`** — default **exact** allowance per tx in the shipped UI, optional **unlimited** CL8Y→TimeCurve (local checkbox) with **H-01** disclosure — [GitLab #143](https://gitlab.com/PlasticDigits/yieldomega/-/issues/143), [`wallet-connection §143`](../../docs/frontend/wallet-connection.md#erc20-approval-sizing-h-01-gitlab-143).

## Truth order

1. **Deployed `TimeCurve`** — `battlePoints`, `warbowLadderPodium`, **`warbowPodiumFinalized`** ( **`distributePrizes`** requires **`warbowPodiumFinalized`** when **`acceptedAsset.balanceOf(podiumPool) > 0`** — [#129](https://gitlab.com/PlasticDigits/yieldomega/-/issues/129); **skipped** when pool balance is **zero** — [#133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133), [`invariants §133`](../../docs/testing/invariants-and-business-logic.md#timecurve-empty-podium-pool-settlement-gitlab-133)), `warbowPendingFlagOwner`, `warbowPendingFlagPlantAt`, **`warbowPendingRevengeExpiryExclusive(victim, stealer)`**, **`warbowPendingRevengeStealSeq(victim, stealer)`** (per-stealer revenge windows — [GitLab #135](https://gitlab.com/PlasticDigits/yieldomega/-/issues/135); **not** legacy single-slot getters), `warbowGuardUntil`, `stealsReceivedOnDay`, **`buyFeeRoutingEnabled`** (issue #55: if **false**, **steal / revenge / guard** revert before CL8Y moves; **not** `claimWarBowFlag` or **`refreshWarbowPodium`** [#129]), constants `WARBOW_*`, `TIMER_RESET_*`, `DEFENDED_STREAK_WINDOW_SEC`.
2. **Events** — `Buy` (BP line items, `hardReset`, streak fields; **`flagPlanted` is `true` iff that buy opted into planting** the WarBow pending flag — [issue #63](https://gitlab.com/PlasticDigits/yieldomega/-/issues/63); regression tests for **referral** and **`buyFor` router** passthrough: [issue #77](https://gitlab.com/PlasticDigits/yieldomega/-/issues/77); it is **not** alone proof of who **currently** holds the flag), `WarBowSteal`, `WarBowRevenge`, **`WarBowRevengeWindowOpened`** (opens/refreshes the **`(victim, stealer)`** window), `WarBowGuardActivated`, `WarBowFlagClaimed`, `WarBowFlagPenalized`, `WarBowCl8yBurned`, defended-streak events.
3. **Product docs** — [`docs/product/primitives.md`](../../docs/product/primitives.md).
4. **Indexer / frontend** — discovery and history; **do not** override chain for eligibility or balances. The Arena hero's suggested steal targets (issue #101) are convenience rows from `warbowLadderPodium()` plus the indexed leaderboard; selecting one should still be verified against live `battlePoints` and `stealsReceivedOnDay`.

## Core rules (participant-facing)

- **Round timer vs WarBow:** **`deadline()`** is the **last inclusive** second **`buy`** and WarBow mutations (steal / revenge / guard / **flag claim** BP) remain onchain-valid; after **`block.timestamp > deadline()`**, txs revert **`timer expired`** until **`endSale`** runs (**[GitLab #136](https://gitlab.com/PlasticDigits/yieldomega/-/issues/136)** — contributor map [`invariants §136`](../../docs/testing/invariants-and-business-logic.md#timecurve-round-deadline-inclusive-warbow-gitlab-136)).
- **Timer:** Each qualifying buy either **extends** the sale end by the configured extension **or**, if **remaining time before the buy** is **strictly below 13 minutes**, performs a **hard reset** so remaining snaps toward **15 minutes** (still capped by the global timer cap). See onchain `TimeMath.extendDeadlineOrResetBelowThreshold`.
- **BP from buys:** Base, hard-reset bonus, **clutch** (remaining before buy **&lt; 30s**), **streak-break**, **ambush** (hard reset plus streak-break in same tx)—see **Documented defaults**; verify `WARBOW_*` on deployment.
- **Defended streak (prize category + WarBow context):** Under **15 minutes** remaining, streak logic and **best** streak for the podium are onchain; WarBow uses **active** streak of the **last buyer under the window** for break/ambush calculations (see primitives).
- **Steal:** Burns **1e18** CL8Y (`WARBOW_STEAL_BURN_WAD`); moves **10%** of victim BP to attacker by default, **1%** if victim is **guarded** (`warbowGuardUntil`). **Ranking ([GitLab #134](https://gitlab.com/PlasticDigits/yieldomega/-/issues/134) · [`invariants §134`](../../docs/testing/invariants-and-business-logic.md#timecurve-warbow-steal-rules-gitlab-134)):** attacker BP **> 0** and victim BP **≥ 2×** attacker BP. **UTC-day caps:** **`stealsReceivedOnDay(victim, day)`** and **`stealsCommittedByAttackerOnDay(attacker, day)`** (same threshold); **4th+** on either counter needs bypass unless documented otherwise — **one** shared bypass burn when either gate binds. Opens a **per-`(victim, stealer)`** revenge window (**24h** exclusive expiry; re-steal from the same stealer refreshes seq + expiry).
- **Revenge:** Victim burns **1e18** CL8Y; takes **10%** of **that stealer's** BP once; clears **only** the **`[victim][stealer]`** slot (`warbowRevenge(stealer)`). Other stealers' windows stay open until consumed or expired.
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

Steal limits keyed to **`block.timestamp / 86400`** (UTC day index). When advising “how many steals left,” use the chain clock and **`stealsReceivedOnDay(victim, dayId)`** (victim receives) plus **`stealsCommittedByAttackerOnDay(attacker, dayId)`** (attacker commits) — [GitLab #134](https://gitlab.com/PlasticDigits/yieldomega/-/issues/134), [`invariants §134`](../../docs/testing/invariants-and-business-logic.md#timecurve-warbow-steal-rules-gitlab-134).

## Tie-break (WarBow ladder top-3)

Higher **BP** ranks above. If two addresses have **equal** BP on the WarBow ladder snapshot, **lower `uint160(address)` ranks higher** (deterministic onchain ordering; see [`docs/product/primitives.md`](../../docs/product/primitives.md)).

## Rare snapshot drift — refresh vs finalize ([GitLab #129](https://gitlab.com/PlasticDigits/yieldomega/-/issues/129))

The **`warbowLadderPodium()`** triple can disagree with authoritative **`battlePoints`** in edge cases discussed in-protocol.

- **`refreshWarbowPodium(address[] candidates)`** — **permissionless**; loops candidates and **`_updateWarbowPodium`** with **live** BP; emits **`WarbowPodiumRefreshed`**; sets **`warbowPodiumFinalized = false`** (owners must **`finalizeWarbowPodium`** again before **`distributePrizes`** runs on a non-zero podium pool).
- **`finalizeWarbowPodium(address[])`** — **`onlyOwner`**, **`ended`**, **`!prizesDistributed`**; clears the WarBow podium, re-inserts every **`battlePoints[c] > 0`** candidate, sets **`warbowPodiumFinalized = true`**; emits **`WarbowPodiumFinalized`**. Not required on the **zero `PodiumPool` balance** **`distributePrizes`** path ([GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133)).
- **Arena UX** — `/timecurve/arena` may show **Claim your WarBow position (refresh snapshot)** when the heuristic in [`timeCurveWarbowSnapshotClaim.ts`](../../frontend/src/lib/timeCurveWarbowSnapshotClaim.ts) detects a mismatch during the live sale (**not** authoritative; still verify **`battlePoints`** + receipt on explorers).

Contributor map — [`INV-WARBOW-129-*`](../../docs/testing/invariants-and-business-logic.md#warbow-podium-snapshot-drifts-gitlab-129) · UX — [`timecurve-views #129`](../../docs/frontend/timecurve-views.md#warbow-ladder-podium-snapshot-mismatch-issue-129).

## What you must not do

- Do not treat **indexer** summaries as authoritative for **revenge / flag / guard** eligibility if they disagree with RPC.
- Do not promise outcomes; disclose MEV, reorgs, and clock skew on “windows.”
- Do not equate **onchain-permitted actions** with **lawful** in every jurisdiction — see [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md).

## Contributor / audit cross-links (issue #70)

- **CL8Y burn invariants (fuzz):** each successful **`warbowActivateGuard`**, **`warbowSteal`** (no bypass), and **`warbowRevenge`** moves the documented **fixed WAD** from the payer to the **burn sink** (`0x…dEaD`) in one tx — see [`TimeCurveWarBowCl8yBurns.t.sol`](../../contracts/test/TimeCurveWarBowCl8yBurns.t.sol) and [invariants — WarBow CL8Y burns](../../docs/testing/invariants-and-business-logic.md#timecurve-warbow-cl8y-burns-issue-70).
- **Policy context:** [CL8Y flow audit](../../docs/onchain/cl8y-flow-audit.md) (approved **user-driven** exception for these burns).
- **Arena hero UX:** steal / guard / revenge are surfaced in `PageHeroArcadeBanner`; target suggestions are discovery-only and preserve live onchain preflight — see [timecurve views #101](../../docs/frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101) and [invariants #101](../../docs/testing/invariants-and-business-logic.md#timecurve-arena-warbow-hero-actions-issue-101). **Open revenge windows:** list **all** pending stealers via indexer when configured — [timecurve views / #135](../../docs/frontend/timecurve-views.md#arena-warbow-hero-actions-issue-101), [invariants #135](../../docs/testing/invariants-and-business-logic.md#warbow-per-stealer-revenge-windows-gitlab-135).
- **Frontend audio (#68):** With audio unlocked, a **sparse** **`warbow_twang`** may play only on **indexed top‑three** leaderboard moments (**enter** the podium from deeper/unranked **or** climb **within** ranks **1–3**; muted for mid‑pack rank drift alone — **`warbowRankSfxPolicy`**; **~18 s** mixer throttle; not every poll). Participant expectation only — UX may change ([sound-effects §8](../../docs/frontend/sound-effects-recommendations.md#8-in-app-implementation-album-1--sfx-bus-issue-68)).

## Related play skills

- [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md) — sale, timer, CHARM, **four** reserve podium **categories**, fee routing.
- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

# TimeCurve primitive (requirements)

## Intent

TimeCurve is a **token launch primitive** that blends ideas from bonding curves, penny auctions, and timer-extension games, biased toward **skill and timing** rather than pure chance. Players earn **charm weight** from each buy (accepted-asset spend) and redeem it for launched tokens after the sale; they also compete for **reserve-asset podium** placements (three categories) and, separately, for **WarBow Ladder** — an adversarial **Battle Points (BP)** score used for status and PvP mechanics. WarBow is **not** a fourth podium prize slice.

## Core mechanics (requirements)

### CHARM band (exponential envelope) vs per-CHARM price (linear schedule)

- **CHARM quantity** for each buy is chosen in **WAD** (1e18 base units = one whole CHARM in UX). Onchain, the allowed band is **0.99–10 CHARM** at envelope factor 1, **scaled by the same exponential daily curve** as the legacy min-buy reference (`TimeMath`, canonical **~25% per day** on the envelope reference). So the **min and max CHARM** per transaction **grow exponentially** with elapsed sale time.
- **Per-CHARM price** (accepted asset per 1e18 CHARM) is **decoupled** from that envelope: it comes from a **pluggable pricing module** (`ICharmPrice`). The default implementation is **linear in time**: `price = basePrice + dailyIncrement × elapsed / 1 day` (for example **$1.00** start and **+$0.10** per day in 18-decimal asset units).
- **Gross spend** for a buy: `amount = charmWad × priceWad / 1e18` (fixed-point; rounding matches onchain `mulDiv`). The UI may restrict to **whole charms 1–10** to stay inside the onchain band and avoid edge reverts.

### Buy and charm redemption semantics

- A buy specifies **`charmWad`** within the current **scaled** `[0.99e18, 10e18]` band (before scaling: base constants; scaled by envelope ÷ reference). The contract pulls **`amount`** in the accepted asset from the buyer and routes the **full gross** through `FeeRouter`. **CHARM weight** accrues in **CHARM WAD units** (plus referral bonuses as CHARM, not reserve transfers). After `endSale`, **`redeemCharms`** transfers launched tokens pro-rata: `totalTokensForSale * charmWeight / totalCharmWeight` (integer division; dust may remain). **Token decimals** follow the launched ERC20. Documentation and events must stay **legible** for agents (no silent rounding offchain).

### Timer extension and hard reset

- **Default branch:** each qualifying buy **extends** the sale **deadline** by **`timerExtensionSec`** (canonical **120 seconds**), subject to the **remaining-time cap** (`timerCapSec` from “now” after the update; canonical **96 hours** from current timestamp).
- **Hard-reset branch:** if **remaining time before the buy** is **strictly below 13 minutes** (`TIMER_RESET_BELOW_REMAINING_SEC = 780`), the deadline is set toward **exactly 15 minutes** remaining (`TIMER_RESET_TO_REMAINING_SEC = 900`), i.e. `newDeadline = min(block.timestamp + 900, block.timestamp + timerCapSec)`, **not** a simple +2m extension. The `Buy` event exposes **`timerHardReset`** when this branch runs.
- **Initial countdown** before the first buy is **`initialTimerSec`** (canonical **24 hours**). **`timerCapSec`** must be ≥ extension and ≥ initial timer.

### Sale end condition

- The sale **ends** when the **timer reaches zero** without further extension past the end boundary.
- After end, **no further buys** are accepted; **redemption** of charms for **DOUB** and **podium** payouts follow rules defined onchain. WarBow **actions** that require an open sale (`!ended`) are blocked after end; **revenge** may still be callable if the contract allows post-end (verify deployment); guard/steal/flag flows in v1 are gated to active sale phase in `TimeCurve`.

### Reserve podium categories (exactly three)

The **podium pool** pays **reserve asset** to **1st / 2nd / 3rd** per category after `endSale` via **`distributePrizes`**. Category **shares of the podium pool** are fixed in **`TimeCurve`** bytecode:

| Category | Share of **podium pool** | Definition (onchain) |
|----------|--------------------------|------------------------|
| **Last buy** | **50%** | **Last qualifying buyers before expiry** — podium slots are the last three buyers in order (final buyer is 1st). |
| **Time booster** | **25%** | **Most effective time added** — cumulative `newDeadline − oldDeadline` per buy (capped behavior reflected in `actualSecondsAdded`; no credit beyond the cap). Podium: top 3 by `totalEffectiveTimerSecAdded`. |
| **Defended streak** | **25%** (remainder after integer split on other slices) | **Best** `bestDefendedStreak` for a wallet under the under-15m reset rules below. |

Within each category, **1st : 2nd : 3rd** payouts use weights **4∶2∶1**. **DOUB** is for **`redeemCharms`** only, not podium payouts.

**Plain language:**

- **Last buy:** last movers before the timer dies.
- **Time booster:** most net seconds actually added to the deadline across the sale.
- **Defended streak:** peak count of under-threshold timer resets by the same wallet (see below).

### WarBow Ladder (Battle Points — PvP, not reserve prizes)

WarBow is **adversarial PvP scoring** in **Battle Points**. It encourages **upward pressure** (e.g. steals require the victim to have **≥ 2×** the attacker’s BP). BP **does not** allocate the reserve podium pool; the contract still tracks a **top-3 BP snapshot** via `warbowLadderPodium()` for UX. **Tie-break:** higher BP ranks above; if BP equal, **lower `uint160(address)`** ranks above (deterministic).

#### BP from buys (defaults in `TimeCurve`)

| Component | Default (BP) | Rule |
|-----------|--------------|------|
| Base qualifying buy | **250** | `WARBOW_BASE_BUY_BP` — any qualifying buy. |
| Timer hard-reset bonus | **500** | Added when **`timerHardReset`** is true (remaining was &lt; 13m before buy). |
| Clutch / ambush timing bonus | **150** | Added when **remaining time before buy** is **strictly below 30 seconds** (`remainingBeforeBuy < 30`). |
| Streak-break bonus | **`priorActiveStreak × 100`** | When this buy **interrupts** another wallet’s **active** defended streak under the 15m window; `WARBOW_STREAK_BREAK_MULT_BP = 100`. |
| **Ambush** BP bonus | **200** | Added **in the same transaction** iff **`timerHardReset`** is true **and** the buyer **breaks** another wallet’s **active** defended streak under the 15m window (so **streak-break bonus &gt; 0** and ambush applies). Reconstruct from `Buy`: `bpAmbushBonus > 0` implies ambush recognized onchain. |

#### Defended streak (podium category + WarBow context)

- **Qualifying increment:** remaining time **before** the buy **&lt; 900s** (15 minutes) **and** `actualSecondsAdded > 0`.
- **Same wallet:** increments `activeDefendedStreak`; updates `bestDefendedStreak` if higher; updates defended-streak podium by **best**.
- **Another wallet buys under 15m:** previous holder’s **active** streak is **zeroed**; **best** remains for leaderboard.
- **Leaving the window** (≥ 15m remaining before buy): clears active holder tracking for the under-window phase (no carryover without fresh qualifying increments).

Dedicated **`WarBowDefendedStreak*`** events (if enabled in bytecode) describe continuation, break, and window exit for indexers; otherwise reconstruct from `Buy` + storage reads.

#### Steal (`warbowSteal`)

- Attacker burns **`WARBOW_STEAL_BURN_WAD`** (**1e18** = 1 CL8Y at 18 decimals) of **accepted asset** to **dead** sink.
- Transfers **`floor(victimBP × 1000 / 10_000)`** (10%) from victim to attacker, **unless** victim is guarded (`block.timestamp < warbowGuardUntil[victim]`), then **`floor(victimBP × 100 / 10_000)`** (1%).
- **2× rule:** requires `victimBP >= 2 × attackerBP` (both at time of call, after any prior logic in the tx).
- **Per-victim daily cap:** **`stealsReceivedOnDay[victim][dayId]`** with `dayId = block.timestamp / 86400` (**UTC day boundary**, Ethereum timestamp). Max **3** normal steals per victim per day; **4th+** in the same UTC day requires **`payBypassBurn == true`** and an extra burn of **50e18** CL8Y (`WARBOW_STEAL_LIMIT_BYPASS_BURN_WAD`).
- Each successful steal sets **revenge** pointers: victim may **`warbowRevenge(stealer)`** within **24 hours** (single pending stealer; overwritten if victim is stolen again).

#### Revenge (`warbowRevenge`)

- Victim burns **1e18** CL8Y; takes **`floor(stealerBP × 1000 / 10_000)`** from stealer to victim **once** per pending slot; clears pending stealer/expiry.
- **Deterministic anti-loop:** only the **last stealer** recorded for that victim is eligible; revenge does not open a reciprocal automatic steal back-and-forth in one invariant — a **new** steal can occur in a later tx. No nested revenge chain in one call.

#### Guard (`warbowActivateGuard`)

- Burn **10e18** CL8Y; extends `warbowGuardUntil[msg.sender]` to **`max(existing, now + 6 hours)`**.

#### Plant flag / claim flag

- On each **buy**, the buyer becomes **`warbowPendingFlagOwner`** at **`warbowPendingFlagPlantAt = block.timestamp`** (`Buy` includes `flagPlanted` when a new plant occurs after clears).
- **`claimWarBowFlag`:** after **`WARBOW_FLAG_SILENCE_SEC` (300s)** with **no other buyer** in between, holder may claim **`WARBOW_FLAG_CLAIM_BP` (1000)** BP.
- **Invalidation:** if **another** buyer purchases **before** claim, pending flag is cleared. **Penalty `2 × WARBOW_FLAG_CLAIM_BP`** applies **only** if that intervening buy occurs **at or after** `plantAt + 300s` (claim was already possible); otherwise the holder loses the claim opportunity **without** the 2× BP penalty.

### CL8Y burns — reasons and events

All WarBow-related accepted-asset burns use **`WarBowCl8yBurned(address indexed payer, uint8 reason, uint256 amountWad)`** with **`WarBowBurnReason`**: e.g. **Steal**, **StealLimitBypass**, **Revenge**, **Guard** (exact numeric values are in Solidity). Specialized events (`WarBowSteal`, `WarBowRevenge`, `WarBowGuardActivated`, …) remain the source for amounts and participants; the burn-reason event is for uniform accounting.

### Determinism and indexer reconstruction

- **Canonical state** lives onchain; indexers **decode events** and MAY mirror views. **Do not** infer ambush or streak-break without **`Buy`** fields (`timerHardReset`, `bpStreakBreakBonus`, `bpAmbushBonus`, …).
- **Tie-breaking** for podiums and WarBow top-3: contract-defined ordering (value desc, then address tie-break where specified).

## Fund routing (high level)

Proceeds and fees are split per [fee routing and governance](../onchain/fee-routing-and-governance.md). TimeCurve emits **rich events** so the indexer can reconstruct participation history for UI and agents.

## Non-requirements (at primitive level)

- TimeCurve does **not** need to own long-term ecosystem governance; **CL8Y** remains the primary governance home for expansion ([vision.md](vision.md)).

## Open parameters (governance / deployment)

- **Accepted asset** (**CL8Y** at launch vs future basket).
- **Auction cadence** if multiple rounds exist.
- **Future** parameterization of podium category shares, WarBow BP constants, or placement ratios if moved out of bytecode (today fixed constants in **`TimeCurve`**).

---

**Agent phase:** [Phase 6 — TimeCurve primitive requirements](../agent-phases.md#phase-6)

**Automated invariant map (tests ↔ this spec):** [testing/invariants-and-business-logic.md](../testing/invariants-and-business-logic.md) (section *TimeCurve (contract)*).

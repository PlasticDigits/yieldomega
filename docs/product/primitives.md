# TimeCurve primitive (requirements)

## Intent

TimeCurve is a **token launch primitive** that blends ideas from bonding curves, penny auctions, and timer-extension games, biased toward **skill and timing** rather than pure chance. Players earn **charm weight** from each buy (accepted-asset spend) and redeem it for launched tokens after the sale; they also pursue **prize categories** with **podium finishes** (1st, 2nd, 3rd) per category.

## Core mechanics (requirements)

### CHARM band (exponential envelope) vs per-CHARM price (linear schedule)

- **CHARM quantity** for each buy is chosen in **WAD** (1e18 base units = one whole CHARM in UX). Onchain, the allowed band is **0.99–10 CHARM** at envelope factor 1, **scaled by the same exponential daily curve** as the legacy min-buy reference (`TimeMath`, canonical **~25% per day** on the envelope reference). So the **min and max CHARM** per transaction **grow exponentially** with elapsed sale time.
- **Per-CHARM price** (accepted asset per 1e18 CHARM) is **decoupled** from that envelope: it comes from a **pluggable pricing module** (`ICharmPrice`). The default implementation is **linear in time**: `price = basePrice + dailyIncrement × elapsed / 1 day` (for example **$1.00** start and **+$0.10** per day in 18-decimal asset units).
- **Gross spend** for a buy: `amount = charmWad × priceWad / 1e18` (fixed-point; rounding matches onchain `mulDiv`). The UI may restrict to **whole charms 1–10** to stay inside the onchain band and avoid edge reverts.

### Buy and charm redemption semantics

- A buy specifies **`charmWad`** within the current **scaled** `[0.99e18, 10e18]` band (before scaling: base constants; scaled by envelope ÷ reference). The contract pulls **`amount`** in the accepted asset from the buyer and routes the **full gross** through `FeeRouter`. **CHARM weight** accrues in **CHARM WAD units** (plus referral bonuses as CHARM, not reserve transfers). After `endSale`, **`redeemCharms`** transfers launched tokens pro-rata: `totalTokensForSale * charmWeight / totalCharmWeight` (integer division; dust may remain). **Token decimals** follow the launched ERC20. Documentation and events must stay **legible** for agents (no silent rounding offchain).

### Timer extension

- Each qualifying buy **extends** a **countdown timer** by a fixed duration. Canonical deployment targets: **120 seconds (2 minutes)** per qualifying buy, **24 hours** initial countdown before the first extension, and a **96-hour** ceiling on remaining time from “now” after each buy (`timerCapSec` ≥ extension and ≥ initial timer).
- Total remaining time is **capped** so the deadline cannot be pushed arbitrarily far with a single buy; the cap rule must be explicit to avoid ambiguity at boundary conditions.

### Sale end condition

- The sale **ends** when the **timer reaches zero** without further extension past the end boundary.
- After end, **no further buys** are accepted; **redemption** of charms for **DOUB** and **podium** payouts follow rules defined onchain.

### Podium categories (first-class)

The system should support **onchain-trackable** leaderboards or deterministic winners. **Each category pays 1st, 2nd, and 3rd** (with explicit tie-breaking). The **podium pool** slice for TimeCurve is routed per [canonical fee sinks](../onchain/fee-routing-and-governance.md#fee-sinks); category shares and placement ratio are **fixed in `TimeCurve`** today ([Podium pool internal split](../onchain/fee-routing-and-governance.md#governance-prize-internal-weights)).

**Categories (onchain v1):** four competition tracks; **opening** and **closing window** categories are **not** used.

| Category | Share of **podium pool** (reserve asset) | Definition (onchain) |
|----------|----------------------------------------|------------------------|
| **Last buy** | **50%** | **Compete to be the last person to buy.** Podium: **1st–3rd** last qualifying buyers before expiry (final buyer is 1st). |
| **Time booster** | **20%** | **Most actual time added to the timer** (cumulative **effective** seconds: `newDeadline − oldDeadline` per buy; **nominal** extension beyond `timerCapSec` does not count). Podium: **1st–3rd** by `totalEffectiveTimerSecAdded`. |
| **Activity leader** | **10%** | **Exactly 250 Activity Points per qualifying buy** (any size). Optional: burn **1 CL8Y** (`ACTIVITY_ATTACK_BURN_WAD`) to move **floor(10%)** of the **current #1** leader’s integer points to the buyer, then the buyer still receives **+250** for that buy. Reverts if no leader, zero leader points, or buyer is #1. Tie-break: lower `uint160(address)` ranks higher when scores tie. |
| **Defended streak** | **20%** (remainder of category split after integer rounding on other slices) | **How many times the same wallet resets the timer while it is under 15 minutes** (`DEFENDED_STREAK_WINDOW_SEC = 900`: remaining time **strictly below** 900 seconds before the buy, and `actualSecondsAdded > 0`). **The streak ends and is recorded when a second player buys under 15 minutes** (prior holder’s **active** zeroed; **`bestDefendedStreak`** keeps the peak for the leaderboard). A buy with **≥ 15 minutes** remaining clears the active holder and resets the final-window marker. |

**Plain language (aligns with frontend tooltips and play skills):**

- **Last buy:** compete to be the last person to buy.
- **Time booster:** most actual time added to the timer.
- **Activity leader:** 250 points each buy, no matter size, and you can burn 1 CL8Y to steal 10% of the leader’s points.
- **Defended streak:** how many times the same wallet resets the timer while it is under 15 minutes; the streak ends and is recorded when a second player buys under 15 minutes.

Within each category, **1st : 2nd : 3rd** payouts use weights **4∶2∶1** (1st is twice 2nd; 2nd twice 3rd). **Podium payouts** are in the **accepted reserve asset** from **`PodiumPool`** after `endSale` via **`distributePrizes`**. **DOUB** is for **`redeemCharms`** only (sale allocation), not for podium payouts.

Exact tie-breaking (same block, same timestamp granularity) must be **specified in contract design** (for example transaction index ordering, log index, buyer address ordering as last resort—transparent and deterministic). **Activity leader** ties use **lower address preferred** when scores are equal; other categories use the contract’s existing top-3 insertion rules.

#### Activity leader — attack edge cases (onchain)

- **Leader identity:** “Current #1” is **`podium(CAT_ACTIVITY_LEADER).winners[0]`** after the last activity update; ties sort with **lower `uint160(address)`** ranked above higher.
- **Steal amount:** `floor(leaderPoints × 1000 / 10_000)`; integer division rounds **down** (e.g. 1–9 leader points → 0 stolen).
- **Order within one buy:** Burn 1 CL8Y (`ACTIVITY_ATTACK_BURN_WAD`) is pulled first; then steal runs, then **+250** is applied to the buyer (so the attacker always gets the normal buy points after the transfer).
- **Reverts:** Attack if there is **no** leader, **zero** leader points, or **buyer is already #1** (cannot attack yourself as leader).
- **Low balance:** Insufficient accepted asset for `amount + 1e18` reverts on `transferFrom` like any buy.

#### Defended streak — recording (onchain)

- **Qualifying reset:** Remaining time **before** the buy must be **strictly below** **`DEFENDED_STREAK_WINDOW_SEC` (900 seconds)** and the buy must add **positive** effective time (`actualSecondsAdded > 0`).
- **Same wallet:** Increments **that** wallet’s `activeDefendedStreak` and updates `bestDefendedStreak` if higher; updates defended-streak podium by **best** score.
- **Other wallet under 15m:** Zeros the previous holder’s **active** only; **`best`** for that holder is unchanged (streak is **recorded**, not discarded).
- **Leaving the window** (≥15m remaining before buy): Zeros **active** for the prior window holder and clears the “last buyer in window” marker; there is **no** continuation of an old active count into a new under-15m phase without fresh increments.

## Fund routing (high level)

Proceeds and fees are split per [fee routing and governance](../onchain/fee-routing-and-governance.md) ([sinks](../onchain/fee-routing-and-governance.md#fee-sinks), [governance](../onchain/fee-routing-and-governance.md#governance-actors), [invariants](../onchain/fee-routing-and-governance.md#post-update-invariants)). TimeCurve should emit **rich events** so the indexer can reconstruct participation history for UI and agents.

## Non-requirements (at primitive level)

- TimeCurve does **not** need to own long-term ecosystem governance; **CL8Y** remains the primary governance home for expansion ([vision.md](vision.md)).

## Open parameters (need human decisions before coding)

- **Accepted asset** (**CL8Y** at launch vs future basket).
- **Auction cadence** if multiple rounds exist.
- **Future** parameterization of podium category shares or placement ratios if governance moves them out of bytecode (today fixed in **`TimeCurve`**).

---

**Agent phase:** [Phase 6 — TimeCurve primitive requirements](../agent-phases.md#phase-6)

**Automated invariant map (tests ↔ this spec):** [testing/invariants-and-business-logic.md](../testing/invariants-and-business-logic.md) (section *TimeCurve (contract)*).

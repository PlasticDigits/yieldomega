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

| Category | Share of **podium pool** (reserve asset) | Podium meaning (deterministic onchain) |
|----------|----------------------------------------|----------------------------------------|
| **Last buyers** | **50%** | **1st–3rd** last qualifying buyers before expiry. |
| **Most buys** | **20%** | **1st–3rd** by total qualifying buy count in the sale. |
| **Biggest buy** | **10%** | **1st–3rd** by single-transaction spend. |
| **Highest cumulative CHARM** | **20%** (remainder of category split after integer rounding on other slices) | **1st–3rd** by **`charmWeight`** (includes referral CHARM bonuses). |

Within each category, **1st : 2nd : 3rd** payouts use weights **4∶2∶1** (1st is twice 2nd; 2nd twice 3rd). **Podium payouts** are in the **accepted reserve asset** from **`PodiumPool`** after `endSale` via **`distributePrizes`**. **DOUB** is for **`redeemCharms`** only (sale allocation), not for podium payouts.

Exact tie-breaking (same block, same timestamp granularity) must be **specified in contract design** (for example transaction index ordering, log index, buyer address ordering as last resort—transparent and deterministic).

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

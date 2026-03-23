# TimeCurve primitive (requirements)

## Intent

TimeCurve is a **token launch primitive** that blends ideas from bonding curves, penny auctions, and timer-extension games, biased toward **skill and timing** rather than pure chance. Players compete to accumulate allocation while pursuing **prize categories** (for example last buyer, most buys, biggest buy, first buyer in a period).

## Core mechanics (requirements)

### Minimum buy growth

- The **minimum buy** increases **continuously** over time from a defined start (for example equivalent to one dollar at launch, exact denomination TBD).
- Growth follows a **daily rule** (for example per-second or per-block interpolation of a daily multiplier). The exact formula is a **governance-set parameter** but must be:
  - **Deterministic** from onchain time or block schedule.
  - **Documented** in deployment parameters and events.

### Purchase cap

- Each purchase amount is **capped** at a **fixed multiple** of the current minimum buy (for example **10x**). The multiple is a configurable constant or governed parameter.

### Price and tranche semantics

- The spend for a buy represents the **price per tranche** (for example per **1,000 tokens** or another fixed tranche size). **Tranche size** and **decimals** are deployment parameters.
- Partial tranches may be disallowed or handled via fixed step sizes (implementation decision); documentation should preserve **legibility** for agents (no silent rounding offchain).

### Timer extension

- Each qualifying buy **extends** a **countdown timer** by a fixed duration (for example **one minute**).
- Total remaining time is **capped** (for example **24 hours** from “now” or from a defined ceiling policy). The cap rule must be explicit to avoid ambiguity at boundary conditions.

### Sale end condition

- The sale **ends** when the **timer reaches zero** without further extension past the end boundary.
- After end, **no further buys** are accepted; **claims** for allocation and prizes follow rules defined onchain.

### Prize categories (first-class)

The system should support **onchain-trackable** leaderboards or deterministic winners for categories such as:

- **Last buyer** before expiry.
- **Most buys** in the sale (or in defined windows).
- **Biggest buy** (single transaction).
- **First buyer** in a defined period (for example first minute, first epoch).

Exact tie-breaking (same block, same timestamp granularity) must be **specified in contract design** (for example block index ordering, buyer address ordering as last resort—transparent and deterministic).

## Fund routing (high level)

Proceeds and fees are split per [../onchain/fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md). TimeCurve should emit **rich events** so the indexer can reconstruct participation history for UI and agents.

## Non-requirements (at primitive level)

- TimeCurve does **not** need to own long-term ecosystem governance; **CL8Y** remains the primary governance home for expansion ([vision.md](vision.md)).

## Open parameters (need human decisions before coding)

- Exact **growth function** (piecewise linear, exponential approximation, per-block step).
- **Accepted asset** (for example USDm only vs basket).
- **Tranche size**, **token decimals**, and **auction cadence** if multiple rounds exist.
- **Fee split** initial weights and change process.

---

**Agent phase:** [Phase 6 — TimeCurve primitive requirements](../agent-phases.md#phase-6)

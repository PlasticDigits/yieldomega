---
name: play-timecurve-doubloon
description: Play the TimeCurve sale primitive and understand Doubloon (DOUB) fee routing. Use when helping a human buy, track timers, charms, prizes, or fee sinks—not when editing Solidity.
---

# Play TimeCurve and DOUB routing

## Scope

You are helping a **participant** use **TimeCurve** (token launch / sale primitive) and understand how **DOUB** and other sinks receive fees. You are **not** implementing contracts; read [`docs/product/primitives.md`](../../docs/product/primitives.md) and [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate.

## Core ideas

- **Minimum buy rises over time**; each buy has **min/max** bounds; **timer** extends on buys up to a **cap**; **`initialTimerSec`** may be shorter than the cap so early activity can still grow remaining time (see deployed parameters).
- **CHARM weight** (including referral bonuses) sets **pro-rata DOUB** after the sale via `redeemCharms` (**denominator `totalCharmWeight`**). **Podium** payouts are **reserve-asset** from **`PodiumPool`** after `endSale` via **`distributePrizes`**, separate from DOUB redemption.
- **Fees:** full **gross** reserve per buy routes through **`FeeRouter`** (five sink slots: **25%** locked DOUB LP · **35%** CL8Y buy-and-burn · **20%** podium pool · **0%** team/reserved · **20%** Rabbit Treasury at documented launch default) per [fee routing](../../docs/onchain/fee-routing-and-governance.md)—**verify** live `FeeRouter` on the target chain.

### TimeCurve reserve podium (onchain v1 — **three** categories)

Authoritative rules: [`docs/product/primitives.md`](../../docs/product/primitives.md) (podium + timer + defended streak). **Do not** describe legacy ideas (fourth “activity” slice, most-buys / biggest-buy / cumulative-CHARM podiums, or opening/closing-window categories); they are **not** in v1.

Plain language for participants:

- **Last buy:** compete to be the last person to buy before the sale ends.
- **Time booster:** most **actual** seconds added to the sale end across your buys (after cap clipping), tracked onchain.
- **Defended streak:** how many times the **same** wallet extends the timer while remaining time **before** the buy is **strictly under 15 minutes**; another buyer under that window **breaks** the active streak (**`bestDefendedStreak`** is what the podium uses).

**WarBow Ladder / Battle Points** are **PvP scoring** (steal, guard, revenge, flag, buy-based BP bonuses) **separate** from these three reserve slices. For WarBow rules and eligibility, use **[`play-timecurve-warbow/SKILL.md`](../play-timecurve-warbow/SKILL.md)** and onchain `battlePoints` / `warbowLadderPodium`.

Reserve podium split from **`PodiumPool`** after the sale is documented as **50% / 25% / 25%** (last buy · time booster · defended streak) — verify `distributePrizes` on the deployment.

When helping someone interpret standings, prefer **contract reads** (`podium(category)`, per-wallet mappings) and **`Buy` events** over indexer summaries unless the user only needs approximate history.

## Success function (non-financial)

**Success** means the user understands **sale state**, **timing constraints**, **fee routing** as **documented and verified onchain**, and **risks**—with **honest uncertainty** where RPC, indexers, or docs disagree—so they can decide **whether** to act. Technical accuracy (correct addresses, parameters, reads) **supports** that outcome.

## Return

When answering, make outputs explicit:

- **Sale state** — `ended`, `deadline`, `saleStart`, **`currentMinBuyAmount`**, and any **pause** flags from **chain reads** (not memory).
- **Timer / charm context** — Remaining time, caps, charm weight mechanics as **published** in primitives + **deployment**; cite **which** contract fields you used.
- **Fee routing snapshot** — Sinks and weights **per verified** `FeeRouter` / deployment for this chain, cross-checked with [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).
- **Risks (disclosure)** — Deadline pressure, MEV, oracle/indexer lag, referral rules in [`docs/product/referrals.md`](../../docs/product/referrals.md)—as **information**, not pressure.
- **Next actions permitted under deployed contracts and published rules** — e.g. buy within min/max if sale open; redeem charms after sale—**informational options**, not “you should.”
- **Uncertainty** — indexer vs chain, **versioned** docs vs live deployment, ambiguous **network** (wrong chain).
- **Confidence** (high / medium / low) with **evidence pointers** (contract fields, tx, events, doc links).

## Canonical evidence (priority order)

Resolve truth in this order; **indexers must not override** onchain state for **balances, winners, or sale outcome**.

1. **Deployed contracts** — `TimeCurve` / `FeeRouter` (and related) **addresses** and **reads** for the target chain.
2. **Relevant events** — e.g. `SaleStarted`, `Buy`, `SaleEnded`, `CharmsRedeemed`, `PrizesDistributed`, `ReferralApplied`, `PodiumPaid` as emitted per [`docs/product/primitives.md`](../../docs/product/primitives.md) and deployment.
3. **Product docs** — [`docs/product/primitives.md`](../../docs/product/primitives.md), [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).
4. **Indexers / frontend** — **discovery only**; **flag** if they disagree with RPC.

## What you should do

1. Read **primitives** and **fee routing** docs above; quote **contract addresses** and **parameters** from RPC for the target chain, not from memory.
2. Explain **risks**: **deadline pressure** and last-minute activity around the sale timer (auction-like dynamics), MEV, oracle/indexer lag, referral rules in [`docs/product/referrals.md`](../../docs/product/referrals.md)—as **disclosure**, not encouragement to chase timers.
3. Prefer **`currentMinBuyAmount`**, **`deadline`**, **`saleStart`**, **`ended`** from chain reads when advising timing.
4. Connect **DOUB** to the ecosystem loop: liquidity and incentives as **productive sinks**, not a separate governance token for the whole ecosystem by default ([`docs/product/vision.md`](../../docs/product/vision.md)).

## What you must not do

- Do not treat the **indexer** or **frontend** as authoritative for balances or winners.
- Do not promise returns or “win” strategies; encourage **testnet** practice.
- Do not equate **actions permitted under deployed contracts and published rules** with **lawful** in a **legal** sense—**jurisdiction and ToS** are separate (see [`why-yieldomega-participation-matters/SKILL.md`](why-yieldomega-participation-matters/SKILL.md) Safety).

## Related play skills

- [`play-timecurve-warbow/SKILL.md`](../play-timecurve-warbow/SKILL.md) — WarBow Ladder PvP (BP, steal/guard/revenge/flag).
- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`collect-leprechaun-sets/SKILL.md`](../collect-leprechaun-sets/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

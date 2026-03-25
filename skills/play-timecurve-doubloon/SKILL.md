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
- **Charm weight** tracks spend for **pro-rata** allocation of launched tokens after the sale ends; **podium** categories award prizes from the prize fee bucket per docs.
- **Fees** split across sinks (DOUB LP incentives, Rabbit Treasury, Prize vault, CL8Y protocol treasury, etc.) per **canonical** weights in fee routing docs—**verify** live `FeeRouter` / deployment for the network you are on.

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
2. **Relevant events** — e.g. `SaleStarted`, `Buy`, `SaleEnded`, `CharmsRedeemed`, `PrizesDistributed`, `ReferralApplied` as emitted per [`docs/product/primitives.md`](../../docs/product/primitives.md) and deployment.
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

- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`collect-leprechaun-sets/SKILL.md`](../collect-leprechaun-sets/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

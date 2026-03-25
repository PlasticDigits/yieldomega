---
name: play-timecurve-doubloon
description: Play the TimeCurve sale primitive and understand Doubloon (DOUB) fee routing. Use when helping a human buy, track timers, charms, prizes, or fee sinks—not when editing Solidity.
---

# Play TimeCurve and DOUB routing

## Scope

You are helping a **participant** use **TimeCurve** (token launch / sale primitive) and understand how **DOUB** and other sinks receive fees. You are **not** implementing contracts; read [`docs/product/primitives.md`](../../docs/product/primitives.md) and [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).

## Core ideas

- **Minimum buy rises over time**; each buy has **min/max** bounds; **timer** extends on buys up to a **cap**; **`initialTimerSec`** may be shorter than the cap so early activity can still grow remaining time (see deployed parameters).
- **Charm weight** tracks spend for **pro-rata** allocation of launched tokens after the sale ends; **podium** categories award prizes from the prize fee bucket per docs.
- **Fees** split across sinks (DOUB LP incentives, Rabbit Treasury, Prize vault, CL8Y protocol treasury, etc.) per **canonical** weights in fee routing docs—**verify** live `FeeRouter` / deployment for the network you are on.

## What you should do

1. Read **primitives** and **fee routing** docs above; quote **contract addresses** and **parameters** from RPC for the target chain, not from memory.
2. Explain **risks**: timer games, MEV, oracle/indexer lag, referral rules in [`docs/product/referrals.md`](../../docs/product/referrals.md).
3. Prefer **`currentMinBuyAmount`**, **`deadline`**, **`saleStart`**, **`ended`** from chain reads when advising timing.
4. Connect **DOUB** to the ecosystem loop: liquidity and incentives as **productive sinks**, not a separate governance token for the whole ecosystem by default ([`docs/product/vision.md`](../../docs/product/vision.md)).

## What you must not do

- Do not treat the **indexer** or **frontend** as authoritative for balances or winners.
- Do not promise returns or “win” strategies; encourage **testnet** practice.

## Related play skills

- [`play-rabbit-treasury/SKILL.md`](../play-rabbit-treasury/SKILL.md)
- [`collect-leprechaun-sets/SKILL.md`](../collect-leprechaun-sets/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

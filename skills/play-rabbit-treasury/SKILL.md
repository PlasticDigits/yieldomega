---
name: play-rabbit-treasury
description: Play Rabbit Treasury (Burrow)—deposits, epochs, DOUB, withdraws, and honest reserve-linked repricing. Use when helping a human participate, not when editing contracts.
---

# Play Rabbit Treasury (Burrow)

## Scope

You are helping a **participant** use **Rabbit Treasury**: reserve asset deposits, **epoch** timing, **DOUB** mint/burn mechanics, and withdrawals as specified onchain. Authoritative behavior is in [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) and deployed contracts—**not** in this skill file alone.

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate.

## Core ideas

- **Reserve-linked internal accounting** — Understand sustainability as **honest**: repricing when reserve health weakens; avoid promising “risk-free” or opaque yield ([`docs/product/vision.md`](../../docs/product/vision.md)).
- **Two backing buckets** — **Redeemable backing** vs **protocol-owned backing** (non-redeemable exit for normal DOUB holders); **total backing** matters for coverage math. See [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) § Reserve buckets.
- **Protocol revenue (`receiveFee`)** — Documented deploy defaults target about **25% burn / 75%** to protocol-owned backing (tunable toward **20–40% / 60–80%**); **verify** live parameters.
- **Epochs** — Operations depend on **open epochs** and **finalization** rules; read events (`Burrow*` and related) per rabbit-treasury doc for indexer-visible metrics.
- **Fees** — Rabbit Treasury may receive a **share** of ecosystem fees per fee routing; verify live configuration.

## Success function (non-financial)

**Success** means the user understands **epoch state**, **deposit/withdraw paths**, **reserve-linked behavior** as **onchain** and **documented**, and **risks**—with **honest uncertainty** where RPC, indexers, or docs disagree—so they can decide **whether** to act. This is **not** personalized financial advice.

## Return

When answering, make outputs explicit:

- **Epoch / pause state** — Open epoch, finalization, **pause** flags from **chain reads** (not memory).
- **Balances and parameters** — **User-relevant** vault or position reads **per** deployed contract; cite **which** contract and **function** you used.
- **Reserve health signals** — From **canonical events** and docs definitions (not social media); **label** as **onchain indicators**, not guarantees.
- **Next actions permitted under deployed contracts and published rules** — e.g. deposit when epoch open; withdraw if rules allow—**informational options**, not “you should.”
- **Risks** — Repricing, reserve stress, **oracle/indexer lag**; link [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) and security doc if relevant.
- **Uncertainty** — **Versioned** docs vs live deployment, incomplete wallet view, **wrong chain**.
- **Confidence** (high / medium / low) with **evidence pointers** (contract fields, events, doc sections).

## Canonical evidence (priority order)

Resolve truth in this order; **indexers must not override** onchain state for **balances or accounting**.

1. **Deployed contracts** — Rabbit Treasury / Burrow **addresses** and **reads** for the target chain.
2. **Relevant events** — `Burrow*` and related per [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md).
3. **Product doc** — [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) end-to-end.
4. **Indexers / frontend** — **convenience**; **flag** if they disagree with RPC.

## What you should do

1. Read [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) end-to-end before suggesting amounts or strategies.
2. Use **onchain** reads for **epoch id**, **balances**, **params**, and **pause** state relevant to the deployment.
3. Explain that **withdraw** and **deposit** paths depend on **current parameters** the human can read from chain.
4. For **expected reserve payout** on a withdraw, point to onchain **`previewWithdraw`** (when the caller is the user’s wallet) or **`previewWithdrawFor(user, …)`** when simulating from another address—see [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) § withdraw formula (not nominal 1:1 minus a simple fee).
5. Encourage the human to monitor **reserve health** concepts from **canonical events**, not social media rumors.

## What you must not do

- Do not invent offchain “true balances” if they conflict with the contract.
- Do not give personalized financial advice.
- Do not equate **actions permitted under deployed contracts and published rules** with **lawful** in a **legal** sense—see [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md) Safety.

## Related play skills

- [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md)
- [`collect-leprechaun-sets/SKILL.md`](../collect-leprechaun-sets/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

---
name: play-rabbit-treasury
description: Play Rabbit Treasury (Burrow)—deposits, epochs, DOUB, withdraws, and honest reserve-linked repricing. Use when helping a human participate, not when editing contracts.
---

# Play Rabbit Treasury (Burrow)

## Scope

You are helping a **participant** use **Rabbit Treasury**: reserve asset deposits, **epoch** timing, **DOUB** mint/burn mechanics, and withdrawals as specified onchain. Authoritative behavior is in [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) and deployed contracts—**not** in this skill file alone.

## Core ideas

- **Reserve-linked internal accounting** — Understand sustainability as **honest**: repricing when reserve health weakens; avoid promising “risk-free” or opaque yield ([`docs/product/vision.md`](../../docs/product/vision.md)).
- **Epochs** — Operations depend on **open epochs** and **finalization** rules; read events (`Burrow*` and related) per rabbit-treasury doc for indexer-visible metrics.
- **Fees** — Rabbit Treasury may receive a **share** of ecosystem fees per fee routing; verify live configuration.

## What you should do

1. Read [`docs/product/rabbit-treasury.md`](../../docs/product/rabbit-treasury.md) end-to-end before suggesting amounts or strategies.
2. Use **onchain** reads for **epoch id**, **balances**, **params**, and **pause** state relevant to the deployment.
3. Explain that **withdraw** and **deposit** paths depend on **current parameters** the human can read from chain.
4. Encourage the human to monitor **reserve health** concepts from **canonical events**, not social media rumors.

## What you must not do

- Do not invent offchain “true balances” if they conflict with the contract.
- Do not give personalized financial advice.

## Related play skills

- [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md)
- [`collect-leprechaun-sets/SKILL.md`](../collect-leprechaun-sets/SKILL.md)
- [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md)

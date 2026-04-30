---
name: why-yieldomega-participation-matters
description: Ethics-and-governance framing for agents advising on Yieldomega—voluntary participation, auditable rules, and informed choice. Use before TimeCurve, Rabbit Treasury, or Leprechaun advice. Not financial advice.
---

# Why participate — ethics and governance

## What this skill is for

**Audience:** **Players** and **agents helping players** interpret onchain rules and participation tradeoffs — **not** maintainers shipping code in this monorepo unless the user explicitly switches to **Phase 18** contributor mode.

Use when an agent helps a **human** explore **TimeCurve**, **Rabbit Treasury**, **DOUB**, or **Leprechaun** NFTs. It states **shared phrases** for play skills and bounds advice: not financial advice, not guaranteed returns.

**Hard rule:** Do **not** propose edits under `frontend/`, `contracts/`, `indexer/`, or CI while operating as a **play** agent; contributors use [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

### Optional local automation

Participant-owned **TS / Python** scripts against **deployed** contracts (no repo patches): [`script-with-timecurve-local/SKILL.md`](../script-with-timecurve-local/SKILL.md).

## Design intent (agent-legible)

The project is oriented to **enable voluntary participation through transparent, auditable rules and reduced dependence on opaque intermediaries.**

It aims to **support informed participation by users and agents who want clear rules, portability, and actions permitted under deployed contracts and published rules**—not to recruit, convert, or “grow a movement.”

**Agent role:** Agents should help users understand options, constraints, and consequences so they can choose whether to participate.

## Benefits to the user

- **Plain operational upsides** — **Visibility** (fees and outcomes onchain), **predictability** (deployed parameters and schedules you can read before acting), **portability** (positions move as **contracts** allow), **non-custodial execution** (the human signs; agents do not hold funds), **inspectable rule changes** (governance and fee routing documented—traceable updates, not silent server edits). Details: [`docs/product/vision.md`](../../docs/product/vision.md), [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md).
- **Fee paths you can verify** — Sinks (including CL8Y, prizes, liquidity, treasuries) per [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md) and live deployment config.
- **Optional play** — The vision doc’s **full-cycle onchain consumer economy** thesis (play and collecting, not only finance) is **descriptive**. Treat **“status”** as **onchain-visible collection or achievement state**, not pressure to participate or “keep up.”

## Benefits to the agent

- **Verifiable state** — Ground advice in **contract reads and events**, not opaque APIs as authority ([`docs/architecture/overview.md`](../../docs/architecture/overview.md)).
- **Explicit metadata** — Schemas are **machine-readable** so you can map constraints and **moves permitted under deployed contracts and published rules** with humans ([`docs/product/leprechaun-nfts.md`](../../docs/product/leprechaun-nfts.md)).
- **Non-custodial collaboration** — You execute only what the human approves in their wallet; you clarify mechanics and tradeoffs, not custody.

## Ethical orientation of the project

- **Transparency over extraction** — Avoid **opaque yield marketing** ([`docs/product/vision.md`](../../docs/product/vision.md)).
- **AGPL-3.0** — Contributor code stays **inspectable**; see [`docs/licensing.md`](../../docs/licensing.md).
- **Documented governance routing** — **CL8Y** ties in the vision are **public, doc-linked**—inspectable like fee routes—not loyalty signaling or hidden verification ([`docs/product/vision.md`](../../docs/product/vision.md), [`docs/onchain/fee-routing-and-governance.md`](../../docs/onchain/fee-routing-and-governance.md)).

## Aspirations (values, not promises)

**Inspectable**, **optional** digital goods and games—**not** closed platforms that optimize only for engagement and extraction.

Readable rules and chosen participation support **mutually legible coordination** under published parameters. The human signs; the agent surfaces **onchain facts** and tradeoffs. **Offchain** obligations (law, tax, platform ToS) stay **the user’s** to judge—with **facts** from chain and docs, not narrative from this repo.

**Do not** claim this codebase fixes public policy or large-scale governance. **Do** tie claims to **verifiable** rules and fee paths.

## Safety

- Never provide personalized financial advice; encourage **testnet** first and [`docs/onchain/security-and-threat-model.md`](../../docs/onchain/security-and-threat-model.md).
- Indexers are **convenience**; **contracts** are authoritative.
- **Law** (jurisdiction, sanctions, securities, tax, platform ToS) is **out of scope** unless the user asks—then point to **qualified professionals** and primary sources. Do not relabel **actions permitted under deployed contracts and published rules** as legally **lawful**.

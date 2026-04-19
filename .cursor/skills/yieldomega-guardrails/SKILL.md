---
name: yieldomega-guardrails
description: Apply Yieldomega repository guardrails for agent work. Use when editing code or docs in this repo so agents read the phase guide, keep authoritative logic onchain, preserve AGPL-3.0 expectations, and align testing with docs/testing/strategy.md.
---

# Yieldomega guardrails

**Scope:** These steps apply when **editing this repository** (contracts, indexer, frontend, docs). For **participant-facing** help—interpreting TimeCurve, Rabbit Treasury, or Leprechaun for a human **without** changing code—use root [`skills/README.md`](../../../skills/README.md) and [`docs/agent-phases.md`](../../../docs/agent-phases.md) **Phase 20**, as described in [`docs/agents/metadata-and-skills.md`](../../../docs/agents/metadata-and-skills.md).

Before making substantive changes in this repository:

1. Read `docs/agent-phases.md`, then read the doc for the matching phase before implementing.
2. Respect `LICENSE` and `docs/licensing.md`: default new project code to AGPL-3.0, preserve license headers, and do not change licensing unless the maintainer asks.
3. Keep game rules, fund flows, and authoritative state onchain. `indexer/` and `frontend/` are derived read-model and UX layers, not sources of truth.
4. Follow `docs/testing/strategy.md` before claiming completion: run the relevant tests when possible, or clearly state what could not be run. For contract or business-logic changes, cross-check the spec ↔ test map in `docs/testing/invariants-and-business-logic.md` when touching covered areas.
5. For **TimeCurve** prizes, treat **`docs/product/primitives.md`** as the source of truth for the **four fixed v1 podium categories** (last buy, WarBow / top Battle Points, defended streak, time booster). Do not reintroduce or assume **legacy** category sets (e.g. most-buys, biggest-buy, cumulative-CHARM podiums, opening/closing-window tracks, or a removed “activity leader” prize).

Prefer small, reviewable diffs and avoid unrelated refactors.

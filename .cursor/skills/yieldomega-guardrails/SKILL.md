---
name: yieldomega-guardrails
description: Apply Yieldomega repository guardrails for agent work. Use when editing code or docs in this repo so agents read the phase guide, keep authoritative logic onchain, preserve AGPL-3.0 expectations, and align testing with docs/testing/strategy.md.
---

# Yieldomega guardrails

Before making substantive changes in this repository:

1. Read `docs/agent-phases.md`, then read the doc for the matching phase before implementing.
2. Respect `LICENSE` and `docs/licensing.md`: default new project code to AGPL-3.0, preserve license headers, and do not change licensing unless the maintainer asks.
3. Keep game rules, fund flows, and authoritative state onchain. `indexer/` and `frontend/` are derived read-model and UX layers, not sources of truth.
4. Follow `docs/testing/strategy.md` before claiming completion: run the relevant tests when possible, or clearly state what could not be run.

Prefer small, reviewable diffs and avoid unrelated refactors.

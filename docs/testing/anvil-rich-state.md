# Anvil rich state (legacy drill)

> **Arena v2:** Prefer **`bash scripts/start-local-anvil-stack.sh`** or **`bash scripts/e2e-anvil.sh`** with **`DeployDev`** (TimeArena + vaults). This document describes an **optional** historical simulation path; it is **not** required for Arena QA ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)).

## Purpose

Drive many onchain events on a local Anvil node so the **indexer** and **frontend** can show non-empty Arena and referral data during manual exploration.

## Proxy addresses

**UUPS:** Use **ERC1967 proxy** addresses from **`DeployDev`** console logs or [`scripts/lib/broadcast_proxy_addresses.sh`](../../scripts/lib/broadcast_proxy_addresses.sh) — not implementation rows in `run-latest.json` ([#61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).

## Related

- [e2e-anvil.md](e2e-anvil.md) — Playwright + `DeployDev`
- [invariants-and-business-logic.md](invariants-and-business-logic.md) — Arena v2 map
- [arena-v2.md](../product/arena-v2.md)

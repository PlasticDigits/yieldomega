---
name: play-active-timecurve
description: Detect the live TimeCurve sale phase onchain (and indexer when configured), then follow the right participant playbook for pre-open, live, or post-end. Use before play-timecurve-doubloon or play-timecurve-warbow when automating the current sale.
---

# Play the active TimeCurve sale

## Scope

**Audience:** **Players** and **agents helping players** decide **what is allowed now** on the **deployed** `TimeCurve` sale — not contributors patching this repository unless the user explicitly opens **Phase 18**.

**Hard rule:** Do **not** propose edits to `frontend/`, `contracts/`, `indexer/`, or CI here. **Contributors:** [Phase 18](../../docs/agent-phases.md#phase-18) and [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md).

**Ethics first:** Read [`why-yieldomega-participation-matters/SKILL.md`](../why-yieldomega-participation-matters/SKILL.md) before urging action. **No profit promises.**

This skill **does not** introduce new game rules. It **routes** you to the right existing playbooks after **phase detection**.

## Phase detection (onchain authority)

Poll or read **before** any write:

| Signal | Contract / API | Notes |
|--------|----------------|-------|
| Sale scheduled? | `saleStart()` | `0` → not scheduled yet (loading / mis-deploy). |
| Sale live for buys? | `block.timestamp >= saleStart()` and `!ended()` and `block.timestamp <= deadline()` | Inclusive **last countdown second** for buys ([GitLab #136](https://gitlab.com/PlasticDigits/yieldomega/-/issues/136)). |
| Round timer expired but not ended? | `block.timestamp > deadline()` and `!ended()` | Owner may still call `endSale()` ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)). |
| Sale ended? | `ended()` | No new buys; post-end gates apply. |

**Indexer (optional, derived):** When `VITE_INDEXER_URL` is set, the app prefers **`GET /v1/timecurve/chain-timer`** and **`GET /v1/timecurve/sale-state`** for hero countdown and phase UX — align automation with **RPC** for submission timing ([issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48), [`ledgerSecIntForPhase`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts)). **Do not** submit txs based on indexer lag alone.

**Frontend phase names** (for cross-checking UI): `saleStartPending` · `saleActive` · `saleExpiredAwaitingEnd` · `saleEnded` — same machine as [`derivePhase`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.ts).

## Branching table

### Pre-open (`ledgerSecInt < saleStart`)

- **No buys**, WarBow CL8Y spends, or flag claims until live.
- **UX:** “TimeCurve Opens In” countdown to `saleStart` ([issue #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115)).
- **Owner context:** `startSaleAt(epoch)` scheduling ([issue #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114)) — participants wait for `saleStart`.
- **Next skills:** Skim [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md) for economics; no wallet writes yet.

### Live (`saleStart <= now <= deadline`, `!ended`)

- **Buys / Kumbaya / referrals:** [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md) — CHARM band, cooldown, fee routing, four reserve podium categories, Kumbaya router ([#65](https://gitlab.com/PlasticDigits/yieldomega/-/issues/65)).
- **WarBow PvP:** [`play-timecurve-warbow/SKILL.md`](../play-timecurve-warbow/SKILL.md) when BP, steal, guard, revenge, or flag planting matter.
- **Custom scripts:** [`script-with-timecurve-local/SKILL.md`](../script-with-timecurve-local/SKILL.md) — RPC-first timing, proxy addresses, env hygiene.
- **Local Anvil bots:** [`bots/timecurve/README.md`](../../bots/timecurve/README.md) (contributor stack; AGPL).

### Post-end (`ended == true` or awaiting `endSale`)

- **No new buys.** Focus on **`redeemCharms`**, **`distributePrizes`**, vesting claims — gated by owner flags ([#55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55), [`final-signoff-and-value-movement.md`](../../docs/operations/final-signoff-and-value-movement.md)).
- **WarBow podium finalize** is governance/operator after `endSale` ([issue #129](https://gitlab.com/PlasticDigits/yieldomega/-/issues/129)) — not a player buy path.
- **Next skills:** [`play-timecurve-doubloon/SKILL.md`](../play-timecurve-doubloon/SKILL.md) (redemption / podiums); WarBow skill for settlement context only.

## Env and addresses

| Network | Where to resolve `TimeCurve` proxy |
|---------|-----------------------------------|
| **MegaETH production** | `indexer/address-registry.megaeth-mainnet.json`, env `VITE_TIMECURVE_ADDRESS`, footer agent card on Simple |
| **Local Anvil** | `local-anvil-registry.json`, `script-with-timecurve-local`, `start-local-anvil-stack.sh` — **ERC1967 proxy**, not implementation row ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)) |

**Kumbaya single-tx buy:** `TimeCurveBuyRouter` + [`docs/integrations/kumbaya.md`](../../docs/integrations/kumbaya.md).

## Return (when advising a user)

Always state explicitly:

1. **Detected phase** (pre-open / live / post-end) and **evidence** (`saleStart`, `deadline`, `ended`, block time).
2. **Permitted actions now** under deployed contracts (informational list).
3. **Which nested skill** to open next (table above).
4. **Risks** — cooldown, band edges, MEV, wrong chain, indexer lag.
5. **Confidence** (high / medium / low).

## Cross-links

- Product: [`docs/product/primitives.md`](../../docs/product/primitives.md)
- UI phase: [`docs/frontend/timecurve-views.md`](../../docs/frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48)
- Invariants: [`INV-FRONTEND-232-FOOTER-SITE-LINKS`](../../docs/testing/invariants-and-business-logic.md#global-footer-site-link-ribbon-gitlab-232)
- Footer discovery: [`FooterSiteLinksCard`](../../frontend/src/components/FooterSiteLinksCard.tsx) below the agent card (global footer + `/timecurve` Simple) — **Agent SKILL.md** pill ([GitLab #232](https://gitlab.com/PlasticDigits/yieldomega/-/issues/232))
- Play index: [`skills/README.md`](../README.md)

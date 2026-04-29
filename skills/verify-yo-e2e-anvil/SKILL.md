---
name: verify-yo-e2e-anvil
description: Run and reason about Anvil-backed Playwright E2E (bash scripts/e2e-anvil.sh). Use for issue #87 — single-worker Playwright when ANVIL_E2E=1, pay-mode data-testid hooks, and avoiding cross-file races on one Anvil + mock wallet.
---

# Verify Anvil E2E (Playwright)

**Why:** [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) starts **one** Anvil, deploys `DeployDev`, builds the app with `VITE_*`, and runs `e2e/anvil-*.spec.ts` with **`ANVIL_E2E=1`**. Specs share **one chain** and the wagmi **mock** account — multi-worker Playwright can **race** unrelated files ([GitLab #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)).

## Invariants (do not regress)

1. With **`ANVIL_E2E=1`**, [`frontend/playwright.config.ts`](../../frontend/playwright.config.ts) uses **`workers: 1`** and **`fullyParallel: false`**. Do not raise Anvil E2E workers without **isolation** (separate Anvil per worker or per project), or document why and get sign-off.
2. **Pay mode** on TimeCurve **Simple** and **Arena** is **toggle buttons**, not `<input name="timecurve-pay-with">`. Stable hooks: **`data-testid="timecurve-simple-paywith-cl8y"`**, **`…-eth`**, **`…-usdm`** on [`TimeCurveSimplePage`](../../frontend/src/pages/TimeCurveSimplePage.tsx) and [`TimeCurveArenaView`](../../frontend/src/pages/timeCurveArena/TimeCurveArenaView.tsx).
3. Wallet-write E2E ([`anvil-wallet-writes.spec.ts`](../../frontend/e2e/anvil-wallet-writes.spec.ts)) must select ETH (or other assets) via **`getByTestId`** inside the **Buy CHARM** `.data-panel` scope, not dead CSS for removed radios.

## Checklist (human or agent)

- [ ] From repo root: `bash scripts/e2e-anvil.sh` completes **green** (Foundry + `npm ci` in `frontend/` as needed).
- [ ] If you only run Playwright manually: `cd frontend && ANVIL_E2E=1 VITE_E2E_MOCK_WALLET=1` after a matching build — confirm **one** worker in the list reporter or config.
- [ ] **ETH route** test: after **`timecurve-simple-paywith-eth`**, expect **Quoted ETH spend** (aria-label) and a resolved quoted amount (not `…`) before moving the slider; then **Buy CHARM** enabled after quote refresh (see [timecurve-views — Buy quote refresh](../../docs/frontend/timecurve-views.md#buy-quote-refresh-kumbaya-issue-56), issue #56).
- [ ] **Optional:** For **back-to-back buys** from the **same** mock wallet without real-time waits, deploy with **`YIELDOMEGA_DEPLOY_NO_COOLDOWN=1`** ([issue #88](https://gitlab.com/PlasticDigits/yieldomega/-/issues/88)) — see [e2e-anvil — buy cooldown](../../docs/testing/e2e-anvil.md#anvil-deploydev-buy-cooldown-gitlab-88) and [`skills/verify-yo-anvil-buy-cooldown/SKILL.md`](../verify-yo-anvil-buy-cooldown/SKILL.md).

## Doc map

- [docs/testing/e2e-anvil.md — Concurrency](../../docs/testing/e2e-anvil.md#anvil-e2e-concurrency-gitlab-87)
- [docs/testing/invariants-and-business-logic.md — Anvil E2E Playwright](../../docs/testing/invariants-and-business-logic.md#anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87)
- [docs/testing/strategy.md — Stage 1](../../docs/testing/strategy.md) (Anvil E2E note)

**Contributor skill:** [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../../.cursor/skills/yieldomega-guardrails/SKILL.md) (repo-wide guardrails; issue #87 item).

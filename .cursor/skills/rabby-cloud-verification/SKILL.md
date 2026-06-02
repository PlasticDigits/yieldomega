---
name: rabby-cloud-verification
description: Run Rabby-based wallet QA on Cloud agents for wrong-network gates, signing, and full issue/MR verification when Playwright mock wallet is insufficient.
---

# Rabby cloud verification

Use this skill when verifying GitLab issues, merge requests, implementations, or security reviews that mention:

- **Wrong network** / [#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95) / `ChainMismatchWriteBarrier`
- **Manual** wallet / Rabby / “path 7” / real `approve` or `buy`
- **PASS (partial)** on chain-mismatch (treat as incomplete until Rabby passes)

## Do not use mock wallet for these

`VITE_E2E_MOCK_WALLET=1` + Playwright mock connector **cannot** switch `chainId`. Mock runs may only assert gate **presence** on the correct chain — that is **partial**, not full PASS.

## Required workflow

1. Read [`docs/testing/rabby-cloud-agent-qa.md`](../../docs/testing/rabby-cloud-agent-qa.md).
2. Ensure Rabby installed: `sudo bash scripts/install-browser-extensions.sh` (once).
3. Ensure wallets imported: `bash scripts/bootstrap-cloud-agent.sh` or `cd frontend && node ../scripts/setup-rabby-dev-wallets.mjs` (xvfb).
4. Start Anvil stack + indexer; build **without** mock:
   - `bash scripts/qa/build-frontend-for-rabby.sh`
   - `cd frontend && npm run preview -- --host 127.0.0.1 --port 5173`
5. Run automated wrong-network verifier:
   - `bash scripts/verify-rabby-chain-mismatch.sh`
6. Complete any issue-specific Rabby steps (e.g. #277 checkbox / legacy `localStorage`) via Chrome or custom Playwright + [`scripts/lib/rabby_playwright.mjs`](../../scripts/lib/rabby_playwright.mjs).

## Environment

| Variable | Default | Notes |
|----------|---------|--------|
| `YIELDOMEGA_RABBY_BASE_URL` | `http://127.0.0.1:5173` | App under test |
| `VITE_CHAIN_ID` | `31337` | Target chain |
| `YIELDOMEGA_RABBY_WRONG_CHAIN_ID` | `1` | Wrong chain for overlay test |
| `YIELDOMEGA_RABBY_HEADLESS` | `0` | Must stay **0** (use xvfb) |
| `RABBY_DEV_PASSWORD` | local dev default | See AGENTS.md |

## Sign-off rules

- **Path 7 / #95:** PASS only after `verify-rabby-chain-mismatch.sh` exits 0 **or** documented manual steps with wrong-chain overlay confirmed.
- **Never** use `pkill -f chrome-profile-rabby` (kills scripts mentioning that path). Use `pkill -f "user-data-dir=.*/chrome-profile-rabby"` per rabby-cloud-agent-qa.md.
- Keep issue **open** if product owner requested manual QA sign-off; note Rabby automation in the verification comment.

## Cross-links

- Contributor guardrails: [`yieldomega-guardrails`](../yieldomega-guardrails/SKILL.md)
- Playwright Anvil (mock): [`docs/testing/e2e-anvil.md`](../../docs/testing/e2e-anvil.md)

# Continuous integration

This document maps **[testing stages](strategy.md)** to **what runs in GitHub Actions** and what remains **manual or optional** locally. Authoritative testing strategy: [strategy.md](strategy.md). **Business logic and invariant ↔ test matrix:** [invariants-and-business-logic.md](invariants-and-business-logic.md).

## Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| **Unit tests** | [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) | `forge test` (contracts), **`cargo clippy --all-targets -- -D warnings`** then `cargo test` (indexer + Postgres: `integration_stage2` includes persist/reorg + **HTTP API** smoke), `npm test` (Vitest), **`npm run test:e2e`** (Playwright **UI smoke** on production build + preview — **no chain**), Python `unittest` in `simulations/`. **No repository secrets** — only `actions/checkout` and public toolchains. Anvil-backed Playwright is **not** part of this job; see [e2e-anvil.md](e2e-anvil.md). |
| **Slither** | [`.github/workflows/slither.yml`](../../.github/workflows/slither.yml) | Static analysis on `contracts/` after `forge build`; `fail-on: high`. Complements (does not replace) audit. |
| **Secret scanning** | [`.github/workflows/gitleaks.yml`](../../.github/workflows/gitleaks.yml) | Gitleaks on push/PR. Uses the default `GITHUB_TOKEN` for the action only; not part of the “unit” gate. |
| **Anvil E2E (optional)** | [`.github/workflows/e2e-anvil.yml`](../../.github/workflows/e2e-anvil.yml) | **`workflow_dispatch` only** — Foundry + [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) (Anvil, `DeployDev`, Playwright `e2e/anvil-*.spec.ts`). **Not** required for merge; use for manual validation. See [e2e-anvil.md](e2e-anvil.md). |
| **Contract fork smoke (optional)** | [`.github/workflows/contract-fork-smoke.yml`](../../.github/workflows/contract-fork-smoke.yml) | **`workflow_dispatch` only** — `forge test --match-contract TimeCurveForkTest` with live RPC via input or secret `FORK_URL`. Default **`unit-tests`** job does **not** set `FORK_URL` (test no-ops). Policy and runbook: [contract-fork-smoke.md](contract-fork-smoke.md). |

Forge dependencies are installed in CI per [contracts/README.md](../../contracts/README.md) (not committed to the repo).

## Required checks by stage

| Stage | What “green” means in CI | Other expectations (not all automated) |
|-------|---------------------------|----------------------------------------|
| **1 — Unit tests** | `unit-tests` workflow succeeds: **Foundry**, **Rust** (`cargo clippy -D warnings` then Postgres-backed `integration_stage2`), **Vitest**, **Playwright** (`npx playwright install --with-deps chromium` then `npm run test:e2e`), **Python** simulations. **`slither`** workflow green for contract changesets (high-severity gate). | **Postgres:** unset `YIELDOMEGA_PG_TEST_URL` locally → `integration_stage2` skips DB work but passes; set a URL for full coverage. **Foundry fork smoke:** [`TimeCurveFork.t.sol`](../../contracts/test/TimeCurveFork.t.sol) skips unless `FORK_URL` is set — CI leaves it unset. Optional live RPC: [contract-fork-smoke.md](contract-fork-smoke.md) and **`contract-fork-smoke`** workflow. **Playwright (CI):** install browsers with `npx playwright install chromium` (and `chromium-headless-shell` if your Playwright version defaults to the shell build). **Anvil E2E** (`scripts/e2e-anvil.sh`) is **local** or via the optional **`e2e-anvil`** workflow (`workflow_dispatch`); not a merge gate — chain-touching specs skip unless `ANVIL_E2E=1`. See [e2e-anvil.md](e2e-anvil.md). Gitleaks on every push/PR. |
| **2 — Devnet integration** | No dedicated workflow yet (needs chain, DB, wallet). Stage 1 must stay green; use the **devnet exit checklist** in [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration). | Deploy to local or MegaETH dev, fresh indexer DB, smoke E2E paths. |
| **3 — Testnet → mainnet** | Same as Stage 1 for merge hygiene; add soak, monitoring, and deployment checks per [strategy.md](strategy.md) and [operations/deployment-stages.md](../operations/deployment-stages.md). | Not covered by the minimal unit-test workflow. |

## Local parity

```bash
# Contracts (from repo root)
cd contracts && forge build && FOUNDRY_PROFILE=ci forge test -vv

# Optional — live RPC fork smoke (set FORK_URL); see contract-fork-smoke.md
# cd contracts && export FORK_URL='https://carrot.megaeth.com/rpc' && FOUNDRY_PROFILE=ci forge test -vv --match-contract TimeCurveForkTest

# Slither (optional local parity with [.github/workflows/slither.yml](../../.github/workflows/slither.yml); install per contracts/README.md)
# cd contracts && slither . --config-file slither.config.json --fail-high

# Indexer — set URL so integration_stage2 actually runs against Postgres (otherwise that test no-ops but passes)
export YIELDOMEGA_PG_TEST_URL='postgres://user:pass@localhost:5432/yieldomega_test'
cd indexer && cargo clippy --all-targets -- -D warnings && cargo test

# Frontend
cd frontend && npm ci && npm test

# Playwright — UI smoke (install browsers once per machine / CI image)
cd frontend && npx playwright install --with-deps && npm run build && npm run test:e2e

# Optional — Anvil-backed E2E (Foundry + deploy + Vite build with VITE_*); see e2e-anvil.md
# bash scripts/e2e-anvil.sh

# Simulations (optional; same suite as Stage 1 strategy)
cd simulations && PYTHONPATH=. python3 -m unittest discover -s tests -v
```

## Related

- [Testing strategy (three stages)](strategy.md)
- [Agent Phase 14 — Testing strategy](../agent-phases.md#phase-14)

**Agent phase:** [Phase 14 — Testing strategy (three stages)](../agent-phases.md#phase-14)

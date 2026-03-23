# Continuous integration

This document maps **[testing stages](strategy.md)** to **what runs in GitHub Actions** and what remains **manual or optional** locally. Authoritative testing strategy: [strategy.md](strategy.md).

## Workflows

| Workflow | File | Purpose |
|----------|------|---------|
| **Unit tests** | [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) | `forge test` (contracts) and `cargo test` (indexer). **No repository secrets** — only `actions/checkout` and public toolchains. |
| **Secret scanning** | [`.github/workflows/gitleaks.yml`](../../.github/workflows/gitleaks.yml) | Gitleaks on push/PR. Uses the default `GITHUB_TOKEN` for the action only; not part of the “unit” gate. |

Forge dependencies are installed in CI per [contracts/README.md](../../contracts/README.md) (not committed to the repo).

## Required checks by stage

| Stage | What “green” means in CI | Other expectations (not all automated) |
|-------|---------------------------|----------------------------------------|
| **1 — Unit tests** | `unit-tests` job succeeds: **Foundry** (`forge build` / `forge test` with `FOUNDRY_PROFILE=ci`) and **Rust** (`cargo test` in `indexer/`). | Optional locally: Python simulations (`simulations/`), frontend tests when introduced. Gitleaks should pass on every push/PR. |
| **2 — Devnet integration** | No dedicated workflow yet (needs chain, DB, wallet). Stage 1 must stay green; use the **devnet exit checklist** in [strategy.md — Stage 2](strategy.md#stage-2--devnet-integration). | Deploy to local or MegaETH dev, fresh indexer DB, smoke E2E paths. |
| **3 — Testnet → mainnet** | Same as Stage 1 for merge hygiene; add soak, monitoring, and deployment checks per [strategy.md](strategy.md) and [operations/deployment-stages.md](../operations/deployment-stages.md). | Not covered by the minimal unit-test workflow. |

## Local parity

```bash
# Contracts (from repo root)
cd contracts && forge build && FOUNDRY_PROFILE=ci forge test -vv

# Indexer
cd indexer && cargo test
```

## Related

- [Testing strategy (three stages)](strategy.md)
- [Agent Phase 14 — Testing strategy](../agent-phases.md#phase-14)

**Agent phase:** [Phase 14 — Testing strategy (three stages)](../agent-phases.md#phase-14)

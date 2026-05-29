# Testing strategy

**CI mapping:** [ci.md](ci.md).

**Business logic + invariant map:** [invariants-and-business-logic.md](invariants-and-business-logic.md).

**Contributor manual QA:** [manual-qa-checklists.md](manual-qa-checklists.md). Root [`skills/`](../../skills/) is **player-facing only**.

## Three stages (plus production)

Quality gates progress from **fast feedback** to **realistic integration** to **public testnet** before **mainnet**. Shared vocabulary: [../glossary.md](../glossary.md).

### Stage 1 — Unit tests

**Scope**

- **Simulations:** `simulations/` — bounded repricing and EcoStrategy scenarios ([`simulations/README.md`](../simulations/README.md)).
- **Scripts:** `bash scripts/test-kumbaya-env-set-line.sh` ([GitLab #154](https://gitlab.com/PlasticDigits/yieldomega/-/issues/154)).
- **Contracts:** `forge test` — **TimeArena** timers, CHARM bounds, DOUB 40/30/30 routing ([`ArenaPrizeRouting.t.sol`](../../contracts/test/ArenaPrizeRouting.t.sol), [`TimeArena.t.sol`](../../contracts/test/TimeArena.t.sol)); **ReferralRegistry**; **DoubPresaleVesting**; ERC-20 balance-delta parity ([#123](https://gitlab.com/PlasticDigits/yieldomega/-/issues/123)).
- **Indexer:** `cargo test` + `cargo clippy`; public API **500** redaction ([#157](https://gitlab.com/PlasticDigits/yieldomega/-/issues/157)).
- **Frontend:** Vitest (`npm test`); **`chainMismatchWriteGuard`** ([#95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)); **`walletBuySessionGuard`** ([#144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144)); placeholder split CSS ([#163](https://gitlab.com/PlasticDigits/yieldomega/-/issues/163)). Playwright UI smoke (`npm run test:e2e`). **Anvil E2E:** [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) — `e2e/anvil-arena-*.spec.ts`, **`ANVIL_E2E=1`**, **single worker** ([#87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)).

**Exit criteria**

- No failing tests on default branch.
- Critical invariants in [invariants-and-business-logic.md](invariants-and-business-logic.md); Arena economics in [arena-v2.md](../product/arena-v2.md).

### Stage 2 — Devnet integration

**Scope**

- Deploy **Arena v2** (`DeployDev`) to local or MegaETH dev.
- Indexer against dev chain with **fresh** Postgres.
- Smoke: connect wallet → **arena buy** → referral read → indexer lag check.

**Exit criteria:** [operations/stage2-run-log.md](../operations/stage2-run-log.md).

### Stage 3 — Testnet → mainnet

See [operations/deployment-stages.md](../operations/deployment-stages.md) and [stage3-mainnet-operator-runbook.md](../operations/stage3-mainnet-operator-runbook.md).

## Environment matrix (conceptual)

| Stage | Chain | Indexer DB | Frontend |
|-------|-------|------------|----------|
| 1 | None / mock | Optional fixtures | Unit only |
| 2 | Dev / local | Ephemeral Postgres | Local static |
| 3 | Testnet | Persistent testnet DB | Hosted staging |
| Production | Mainnet | Production DB | Production CDN |

---

**Agent phase:** [Phase 14](../agent-phases.md#phase-14)

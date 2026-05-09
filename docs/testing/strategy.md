# Testing strategy

**CI mapping (what runs in GitHub Actions vs manual gates):** [ci.md](ci.md).

**Business logic + invariant map (specs ↔ tests, full contract/sim/indexer inventory):** [invariants-and-business-logic.md](invariants-and-business-logic.md).

**Contributor manual QA (row-by-row checklists, relocated from deprecated root QA skills — [GitLab #100](https://gitlab.com/PlasticDigits/yieldomega/-/issues/100)):** [manual-qa-checklists.md](manual-qa-checklists.md). Root [`skills/`](../../skills/) is **player-facing only** (six play skills + [`skills/README.md`](../../skills/README.md)).

## Three stages (plus production)

Quality gates progress from **fast feedback** to **realistic integration** to **public testnet** before **mainnet**. Shared vocabulary: [../glossary.md](../glossary.md).

### Stage 1 — Unit tests

**Scope**

- **Simulations:** `simulations/` — `PYTHONPATH=. python3 -m unittest discover -s tests -v` for bounded repricing, faction comeback, and **EcoStrategy scenarios** ([GitLab #161](https://gitlab.com/PlasticDigits/yieldomega/-/issues/161), sim coverage [GitLab #167](https://gitlab.com/PlasticDigits/yieldomega/-/issues/167) — `python3 -m ecostrategy`; see [../simulations/README.md](../simulations/README.md)). Same command runs in the **`simulations-test`** job of [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml).
- **Scripts:** `bash scripts/test-kumbaya-env-set-line.sh` — regression for literal **`KEY=value`** merges into **`frontend/.env.local`** ([`INV-KUMBAYA-ENV-154`](invariants-and-business-logic.md#kumbaya-env-local-line-merge-gitlab-154), [GitLab #154](https://gitlab.com/PlasticDigits/yieldomega/-/issues/154)); **`scripts-smoke`** job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml).
- **Contracts:** `forge test` — invariants, edge cases, fuzz on TimeCurve timers, **CHARM bounds** (exponential envelope), and **linear per-CHARM pricing**; treasury accounting math (`BurrowMath`); NFT mint constraints; **`AccessControl` admin address** must be non-zero at initialize/constructor for core governance surfaces ([invariants — #120](invariants-and-business-logic.md#accesscontrol-zero-admin-deployments-gitlab-120), [GitLab #120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120); indexer/frontend **do not** observe failed zero-admin deploys — **`INV-INDEXER-120-DEPLOY`**, **`INV-FRONTEND-120-DEPLOY`**). **`distributePrizes`** empty **`PodiumPool`** settlement (**`PrizesSettledEmptyPodiumPool`** + **`prizesDistributed`** latch — [GitLab #133](https://gitlab.com/PlasticDigits/yieldomega/-/issues/133), [invariants §133](invariants-and-business-logic.md#timecurve-empty-podium-pool-settlement-gitlab-133)). **Regression batch** pinning #131 / #138 review items (**Doubloon** secondary-minter burn, WarBow paths, fee-routing freeze, vesting excess DOUB) — [GitLab #146](https://gitlab.com/PlasticDigits/yieldomega/-/issues/146), [invariants §146](invariants-and-business-logic.md#indexer-block-ingest-transaction-gitlab-146) (indexer transactional ingest + integration test). Optional **public RPC fork smoke** (`TimeCurveFork.t.sol`) is off unless `FORK_URL` is set — CI stays deterministic; see [contract-fork-smoke.md](contract-fork-smoke.md).
- **Indexer:** Rust unit tests for decoders, reorg rollback logic, schema migrations (where testable without chain). CI runs **`cargo clippy --all-targets -- -D warnings`** before `cargo test` (see [ci.md](ci.md)). **Public API `500` bodies** must not echo raw Postgres/sqlx strings — [`INV-INDEXER-157`](invariants-and-business-logic.md#indexer-public-api-500-error-redaction-gitlab-157) ([GitLab #157](https://gitlab.com/PlasticDigits/yieldomega/-/issues/157); [`indexer/src/api.rs`](../../indexer/src/api.rs)).
- **Frontend:** Vitest for pure helpers (`npm test` in `frontend/`), including TimeCurve [sale phase + `ledgerSecIntForPhase`](../frontend/timecurve-views.md#chain-time-and-sale-phase-issue-48) ([`timeCurveSimplePhase.test.ts`](../../frontend/src/pages/timecurve/timeCurveSimplePhase.test.ts), [invariants](invariants-and-business-logic.md#timecurve-frontend-sale-phase-and-hero-timer), [issue #48](https://gitlab.com/PlasticDigits/yieldomega/-/issues/48)). **Placeholder `.split-layout` hero figures ([GitLab #163](https://gitlab.com/PlasticDigits/yieldomega/-/issues/163)):** [`placeholderSplitLayoutCss.test.ts`](../../frontend/src/lib/placeholderSplitLayoutCss.test.ts) asserts **`index.css`** keeps **`.split-layout > .placeholder-figure`** **`align-self: start`** + width caps (**`INV-FRONTEND-163`**, [invariants §163](invariants-and-business-logic.md#placeholder-split-layout-figure-gitlab-163)). **`chainMismatchWriteMessage`** vs **`VITE_CHAIN_ID`** target ([`chainMismatchWriteGuard.test.ts`](../../frontend/src/lib/chainMismatchWriteGuard.test.ts); [wrong-chain § #95](invariants-and-business-logic.md#frontend-wallet-chain-write-gating-issue-95), [issue #95](https://gitlab.com/PlasticDigits/yieldomega/-/issues/95)). **TimeCurve buy wallet session drift mid-flow ([`walletBuySessionGuard.test.ts`](../../frontend/src/lib/walletBuySessionGuard.test.ts); [§ #144](invariants-and-business-logic.md#timecurve-buy-wallet-session-drift-gitlab-144), [issue #144](https://gitlab.com/PlasticDigits/yieldomega/-/issues/144)).** **`/referrals`** **`registerCode`** session drift (**[`referralRegisterWalletSession.test.ts`](../../frontend/src/pages/referrals/referralRegisterWalletSession.test.ts)**; [§ #155](invariants-and-business-logic.md#referral-registration-wallet-session-drift-gitlab-155), [issue #155](https://gitlab.com/PlasticDigits/yieldomega/-/issues/155)). **`/vesting`** **`useWriteContract`** error clears only on wrong-chain → target return (**[`presaleVestingWriteErrorChainReset.test.ts`](../../frontend/src/pages/presaleVesting/presaleVestingWriteErrorChainReset.test.ts)**; [**`INV-FRONTEND-166`**](invariants-and-business-logic.md#presale-vesting-claim-wagmi-error-clear-on-target-gitlab-166), [issue #166](https://gitlab.com/PlasticDigits/yieldomega/-/issues/166)). **WarBow protocol `refresh-candidates` UI paging guard ([GitLab #174](https://gitlab.com/PlasticDigits/yieldomega/-/issues/174)):** [`warbowRefreshCandidatesPagination.test.ts`](../../frontend/src/lib/warbowRefreshCandidatesPagination.test.ts) (**[`INV-FRONTEND-174-WARBOW-REFRESH-GUARD`](invariants-and-business-logic.md#gitlab-174-warbow-refresh-pagination-guard)**). Playwright smoke on the production build (`npm run test:e2e` after `playwright install`, CI: `playwright-e2e` job). That CI job is **UI-only** (routes, nav) — it does **not** start Anvil; it includes **`/referrals` surface + `?ref=` capture** ([`referrals-surface.spec.ts`](../../frontend/e2e/referrals-surface.spec.ts), [issue #64](https://gitlab.com/PlasticDigits/yieldomega/-/issues/64)). **Referral registry registration ordering (#121)** is disclosed in UX + [`docs/product/referrals.md`](../product/referrals.md#referral-registration-ordering-issue-121); **deterministic mempool races are out of scope** for Forge/Vitest (see [invariants — **#121**](invariants-and-business-logic.md#referral-registration-ordering-issue-121); Anvil E2E asserts the **`referrals-register-ordering-disclosure`** element only). **Keyboard focus visibility (WCAG 2.4.7)** uses global **`index.css`** **`:focus-visible`** plus **`[data-rk]`** mirrors for RainbowKit ([invariants — #97](invariants-and-business-logic.md#keyboard-focus-visible-wcag-247-gitlab-97), [issue #97](https://gitlab.com/PlasticDigits/yieldomega/-/issues/97), contributor manual QA — [focus visible (#97)](manual-qa-checklists.md#manual-qa-issue-97)). **Anvil-backed** E2E (RPC reads against a local node + `DeployDev`) is documented in [e2e-anvil.md](e2e-anvil.md); run locally via [`scripts/e2e-anvil.sh`](../../scripts/e2e-anvil.sh) / `npm run test:e2e:anvil` in `frontend/`. When **`ANVIL_E2E=1`**, Playwright is **single-worker** (one shared Anvil + mock account — [e2e-anvil — Concurrency](e2e-anvil.md#anvil-e2e-concurrency-gitlab-87), [invariants](invariants-and-business-logic.md#anvil-e2e-playwright-concurrency-and-pay-mode-selectors-issue-87), [issue #87](https://gitlab.com/PlasticDigits/yieldomega/-/issues/87)). The same Anvil harness includes **`/vesting`** (**`DoubPresaleVesting`**, [issue #92](https://gitlab.com/PlasticDigits/yieldomega/-/issues/92)). **Arena WarBow indexer ladder + rivalry feed** refresh after txs + backoff poll ([GitLab #182](https://gitlab.com/PlasticDigits/yieldomega/-/issues/182), [**`INV-FRONTEND-182-WARBOW-IDX`**](invariants-and-business-logic.md#timecurve-arena-warbow-indexer-refresh-gitlab-182), [`useTimeCurveArenaModel.tsx`](../../frontend/src/pages/timeCurveArena/useTimeCurveArenaModel.tsx), [manual QA — #182](manual-qa-checklists.md#manual-qa-issue-182)). **Arena WarBow Chasing pack** — full indexed ladder + scroll (**[`INV-FRONTEND-189-WARBOW-CHASING-PACK`](invariants-and-business-logic.md#timecurve-arena-warbow-chasing-pack-gitlab-189)**, [GitLab #189](https://gitlab.com/PlasticDigits/yieldomega/-/issues/189), [`warbowChasingPackLeaderboard.test.ts`](../../frontend/src/pages/timeCurveArena/warbowChasingPackLeaderboard.test.ts), [manual QA — #189](manual-qa-checklists.md#manual-qa-issue-189)). Anvil E2E does not replace MegaETH testnet validation (gas and execution model differ).

**Entry criteria**

- Code compiles; CI can run tests without secrets.

**Exit criteria**

- No failing tests on default branch.
- Critical invariants documented next to tests and summarized in [invariants-and-business-logic.md](invariants-and-business-logic.md); align fee-routing expectations with [post-update invariants](../onchain/fee-routing-and-governance.md#post-update-invariants) in [fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md).

### Stage 2 — Devnet integration

**Scope**

- Deploy contracts to **local** or **MegaETH dev** environment (per tooling availability).
- Run indexer against the dev chain with a **fresh database**.
- **Smoke E2E:** wallet connects, executes a buy, a deposit, and an NFT read path; indexer shows consistent history within expected **lag**.

**Entry criteria**

- Stage 1 green; deployment scripts or documented manual deploy steps exist.

**Exit criteria (checklist)**

- [x] **Contracts** deployed to the target dev environment; versions/commits recorded (match the branch under test). _See [operations/stage2-run-log.md](../operations/stage2-run-log.md)._
- [x] **Indexer** runs against that chain with a **fresh** Postgres database; migrations applied cleanly from empty. _Recorded in run log._
- [x] **Smoke E2E** completed: connect wallet → **buy** → **deposit** → **NFT read path**; no blocking failures on these paths. _CLI smoke + UI wiring in repo; details in run log._
- [x] **Indexer lag** is under the agreed threshold (for example **&lt; N blocks** behind tip under normal load); **N** and measurement conditions noted in the run log or ticket. _Run log: N = 0 after catch-up (idle)._
- [x] **History consistency:** indexer shows transactions/events that match chain state for the smoke actions (no missing or contradictory rows for those paths). _Run log: row counts + API._
- [x] **Reorg handling** exercised at least once: **Postgres integration tests** (`indexer/tests/integration_stage2.rs`) run in CI with a service container and assert `rollback_after` truncates event tables + `indexed_blocks` and resets `chain_pointer`. _Live Anvil fork/reset drill remains optional operator follow-up per [indexer/REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md); see [operations/stage2-run-log.md](../operations/stage2-run-log.md) §6._
- [x] **No critical regressions** on smoke paths (security or fund-flow breakages block exit until fixed or explicitly waived with sign-off).

### Stage 3 — Testnet release → final deployment

**Scope**

- Deploy to **public MegaETH testnet**; verify contracts on explorer.
- **Soak:** run indexer and minimal frontend against testnet for a defined period; monitor errors and restarts.
- **Address registry:** publish canonical addresses and ABI hashes for consumers and agents.
- After sign-off, promote to **mainnet** using [../operations/deployment-stages.md](../operations/deployment-stages.md).

**Entry criteria**

- Stage 2 passed; security review milestones defined ([../onchain/security-and-threat-model.md](../onchain/security-and-threat-model.md)).

**Exit criteria**

- **Monitoring** in place (RPC errors, indexer head lag, DB health).
- **Rollback / pause** plan documented if applicable (governance or circuit breakers TBD at implementation).
- **Mainnet** deployment matches audited commit hash.

## Environment matrix (conceptual)

| Stage | Chain | Indexer DB | Frontend |
|-------|-------|------------|----------|
| 1 | None / mock | Optional unit fixtures | Unit only |
| 2 | Dev / local | Ephemeral Postgres | Local static |
| 3 | Testnet | Persistent testnet DB | Hosted staging |
| Production | Mainnet | Production DB | Production CDN |

## Agent prompt reference

Use [Phase 14](../agent-phases.md#phase-14) when wiring CI documentation or minimal workflows.

---

**Agent phase:** [Phase 14 — Testing strategy (three stages)](../agent-phases.md#phase-14)

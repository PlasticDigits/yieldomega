# Agent implementation phases (0% → 100%)

This document is the **code-delivery roadmap** after [`agent-phases.md`](agent-phases.md) planning is complete. Where **agent-phases** ties each step to documentation and design prompts, **implementation phases** tie work to **mergeable artifacts**, **tests**, and **promotion gates** in [`testing/strategy.md`](testing/strategy.md) and [`operations/deployment-stages.md`](operations/deployment-stages.md).

**Arena v2 authority:** Active implementation phases target **TimeArena**, **PodiumVaults**, and **AdminSellVault** — not retired v1 launchpad sale, Rabbit Treasury, or five-sink CL8Y wiring. Doc cleanup: [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274) · [#276](https://gitlab.com/PlasticDigits/yieldomega/-/issues/276).

**Rules for every implementation phase**

- Default license for new code: **AGPL-3.0**; respect [licensing.md](licensing.md).
- **Authoritative state stays onchain**; [`indexer/`](../indexer/) and [`frontend/`](../frontend/) remain derived read models and UX — see [architecture/overview.md](architecture/overview.md).
- Before coding, re-read the linked product/onchain doc and [glossary.md](glossary.md).
- After substantive work, satisfy the **exit criteria** below and align with [testing/strategy.md](testing/strategy.md).
- Prefer small, reviewable PRs over monolithic dumps.

---

## What “100%” means here

| Milestone | Meaning |
|-----------|---------|
| **~25%** | Contracts cover core mechanics with **Stage 1** tests green; deploy scripts exist for dev. |
| **~50%** | Indexer decodes canonical events and serves a minimal API; frontend reads real data on dev paths. |
| **~75%** | **Stage 2** (devnet integration) exit checklist in [testing/strategy.md](testing/strategy.md) is satisfied. |
| **~90%** | **Stage 3** (public testnet): verified contracts, soak, published address registry. |
| **100%** | **Mainnet** (or maintainer-declared production) deployment per [operations/deployment-stages.md](operations/deployment-stages.md), with monitoring and rollback notes; **audited commit** recorded. |

“100%” is **not** “every possible feature”—it is **production promotion** with agreed security and ops gates. Scope gaps stay explicit **TODOs** in code or issues, not hidden assumptions.

### Repository vs operational completion

| Layer | What “done” means |
|-------|-------------------|
| **Repository (impl-0 … impl-10)** | Code, tests, CI, Stage 2 evidence, and operator templates/scripts live in git. Maintainers run the matrix in [testing/invariants-and-business-logic.md](testing/invariants-and-business-logic.md) before merge. |
| **~90% / 100% (impl-11 … impl-12)** | Requires **live networks**, keys, explorer verification, soak, audit/sign-off, and filled rows in [operations/deployment-checklist.md](operations/deployment-checklist.md). Follow [operations/stage3-mainnet-operator-runbook.md](operations/stage3-mainnet-operator-runbook.md). No commit alone substitutes for these steps. |

---

## Baseline (today)

**Implementation phases in this repo (code + docs):**

| Phase | Scope | Status |
|-------|--------|--------|
| impl-0 | Parameters / interfaces tracked | [`contracts/PARAMETERS.md`](../contracts/PARAMETERS.md), [`contracts/README.md`](../contracts/README.md) |
| impl-1 … impl-5 | Libraries, TimeArena, PodiumVaults/AdminSellVault, arena buy routing, collectible NFT (retired #241) | Historical v1 under `contracts/src/`; Arena v2 is authority |
| impl-6 | Deploy + address registry | [`DeployDev.s.sol`](../contracts/script/DeployDev.s.sol), [`dev-addresses.example.json`](../contracts/deployments/dev-addresses.example.json), [`stage2-anvil-registry.json`](../contracts/deployments/stage2-anvil-registry.json), [`contracts/deployments/README.md`](../contracts/deployments/README.md) |
| impl-7 … impl-8 | Indexer schema, decoders, API, reorg | `indexer/` migrations + `cargo test` (incl. Postgres rollback integration when `YIELDOMEGA_PG_TEST_URL` is set in CI) |
| impl-9 | Frontend wallet + reads | `frontend/` + [`frontend/.env.example`](../frontend/.env.example) |
| impl-10 | Stage 2 exit checklist | [testing/strategy.md](testing/strategy.md) Stage 2 boxes checked; evidence [operations/stage2-run-log.md](operations/stage2-run-log.md) |
| impl-11 | Stage 3 testnet | **Operator-run** — runbook [operations/stage3-mainnet-operator-runbook.md](operations/stage3-mainnet-operator-runbook.md) §Stage 3 |
| impl-12 | Mainnet + audit | **Operator-run** — same runbook §Mainnet; record audited commit in checklist |

**Contracts (~25% row):** Foundry stack implements **Arena v2** — [`TimeArena`](../contracts/src/arena/TimeArena.sol), [`PodiumVaults`](../contracts/src/arena/PodiumVaults.sol), [`AdminSellVault`](../contracts/src/arena/AdminSellVault.sol), [`PlayCred`](../contracts/src/tokens/PlayCred.sol); legacy v1 contracts may remain for history. **Stage 1** contract tests green via `forge test` (CI: `FOUNDRY_PROFILE=ci` per [testing/ci.md](testing/ci.md)); dev deploy via [`DeployDev.s.sol`](../contracts/script/DeployDev.s.sol). Parameter checklist: [`contracts/PARAMETERS.md`](../contracts/PARAMETERS.md).

**~50% row (indexer + frontend reads):** Rust [**indexer**](../indexer/) decodes **TimeArena** / referral registry events, persists to Postgres ([`migrations/`](../indexer/migrations/)), runs JSON-RPC ingestion with reorg rollback ([`ingestion.rs`](../indexer/src/ingestion.rs), [`reorg.rs`](../indexer/src/reorg.rs)), and exposes versioned HTTP endpoints + CORS ([`api.rs`](../indexer/src/api.rs)). Vite [**frontend**](../frontend/) reads contract state via wagmi/viem and optional indexer URLs configured in [`frontend/.env.example`](../frontend/.env.example).

**~75% row (Stage 2 devnet integration):** Exit checklist in [testing/strategy.md](testing/strategy.md) is **satisfied** with evidence in [**operations/stage2-run-log.md**](operations/stage2-run-log.md) (deploy + fresh DB + smoke txs + lag + history). **Reorg:** Postgres integration tests exercise `rollback_after` in CI (see `indexer/tests/integration_stage2.rs`); optional **live Anvil reorg drill** remains in [indexer/REORG_STRATEGY.md](../indexer/REORG_STRATEGY.md). **Verification:** run the full matrix in [testing/invariants-and-business-logic.md](testing/invariants-and-business-logic.md) before claiming this milestone. **Next milestone (~90%):** execute Stage 3 per [operations/stage3-mainnet-operator-runbook.md](operations/stage3-mainnet-operator-runbook.md) and [testing/strategy.md](testing/strategy.md) Stage 3.

---

<a id="impl-0"></a>

## Implementation phase 0 — Lock parameters and interfaces

**Goal:** Freeze or explicitly **TODO** every numeric policy and external dependency called out in [product/time-arena.md](product/time-arena.md), [product/arena-v2.md](product/arena-v2.md), [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md), and [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md).

**Deliverables**

- Written list (issue or short `contracts/README.md` / design note): podium timer params, buy cooldown, 100% podium routing shares (70/20/10 epoch tranches per [#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)), charm price band, governance addresses vs placeholders.

**Exit criteria**

- No contract PR starts with “we’ll pick numbers later” for security-critical fields without a tracked **TODO** and bounds.

**Agent prompt (copy-paste):**

```text
You are implementing Yieldomega on MegaEVM. Read docs/product/time-arena.md, docs/product/arena-v2.md, docs/onchain/fee-routing-and-governance.md, and docs/research/stablecoin-and-reserves.md. Produce a single checklist of parameters that need human-fixed values before mainnet, with suggested conservative testnet defaults where safe. Do not write Solidity until the maintainer confirms or defers each item with an explicit TODO location.
```

---

<a id="impl-1"></a>

## Implementation phase 1 — Contracts: shared libraries and tooling

**Docs:** [contracts/foundry-and-megaeth.md](contracts/foundry-and-megaeth.md), [contracts/README.md](../contracts/README.md) (if present)

**Goal:** Foundry project is CI-clean, modularized for MegaEVM constraints, and extends existing math ([`BurrowMath`](../contracts/src/libraries/BurrowMath.sol)) as specs require.

**Deliverables**

- Libraries / helpers used by TimeArena and PodiumVaults (e.g. fixed-point, time math, arena buy routing) with **unit tests** and **documented invariants** next to tests.
- `forge test` passes locally and in [CI per docs/testing/ci.md](testing/ci.md).

**Exit criteria**

- Stage 1 **contracts** slice in [testing/strategy.md](testing/strategy.md) is green for this scope.

**Agent prompt (copy-paste):**

```text
Read docs/contracts/foundry-and-megaeth.md and docs/testing/strategy.md Stage 1. Extend contracts/ with shared libraries only—no full game contracts yet. Match style of existing BurrowMath.sol; add tests; run forge test. AGPL-3.0 headers on new files. Small PR.
```

---

<a id="impl-2"></a>

## Implementation phase 2 — Contracts: TimeArena primitive

**Docs:** [product/time-arena.md](product/time-arena.md), [product/arena-v2.md](product/arena-v2.md), [onchain/security-and-threat-model.md](onchain/security-and-threat-model.md)

**Goal:** Onchain TimeArena matches the spec: four podium timers, DOUB buys, 100% podium vault routing ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)), permissionless `rollPodiumEpoch` settlement, events for indexers.

**Deliverables**

- **TimeArena** (with **PodiumVaults** / **AdminSellVault** wiring) with **state**, **events**, and **access control** per [arena buy routing](onchain/fee-routing-and-governance.md).
- **Fuzz / invariant tests** for timer caps, buy cooldown, podium settlement, and WarBow epoch behavior per threat model.

**Exit criteria**

- Spec checklist from [agent-phases Phase 6](agent-phases.md#phase-6) is implementable and **checked off** in test names or a short test README.
- `forge test` green.

**Agent prompt (copy-paste):**

```text
Implement the TimeArena primitive per docs/product/time-arena.md, docs/product/arena-v2.md, and docs/onchain/security-and-threat-model.md. Emit indexer-friendly events (Buy, PodiumEpochRolled, PodiumFunded, etc.). Add fuzz/invariant tests for edge cases including rollPodiumEpoch after expiry. Document 100% podium routing invariants ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)). Run forge test.
```

---

<a id="impl-3"></a>

## Implementation phase 3 — Retired: Rabbit Treasury (Burrow)

**Status:** Removed in Arena v2 ([#242](https://gitlab.com/PlasticDigits/yieldomega/-/issues/242)). Historical docs: [product/rabbit-treasury.md](product/rabbit-treasury.md). Doc cleanup: [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274).

**Goal:** Do not implement new RabbitTreasury deposit/withdraw flows. Arena v2 funds podiums via per-buy DOUB routing to **PodiumVaults** and **AdminSellVault**.

**Exit criteria**

- No active deploy script, indexer decode path, or frontend route for Burrow deposits.

**Agent prompt (copy-paste):**

```text
Do not implement RabbitTreasury for Arena v2 unless explicitly scoped for historical review. If auditing removal, confirm no active user flow references Burrow deposit/withdraw outside archive docs and CHANGELOG. Arena prize funding is PodiumVaults + AdminSellVault per docs/product/arena-v2.md.
```

---

<a id="impl-4"></a>

## Implementation phase 4 — Contracts: arena buy routing and vault sinks

**Docs:** [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md), [onchain/treasury-contracts.md](onchain/treasury-contracts.md), [product/arena-v2.md](product/arena-v2.md)

**Goal:** Explicit **PodiumVaults** (active + seed + future epoch pools) destinations; **100%** podium split enforced on each DOUB buy via **ArenaBuyRouting** ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)).

**Deliverables**

- Deployments or modules for **PodiumVaults**, **AdminSellVault**, and **PlayCred** (or documented **TODO** + test doubles as allowed by governance doc).
- **TimeArena** buy path routes DOUB to vaults; tests for routing invariants and governance parameter updates.

**Exit criteria**

- Buy routing shares are **governed** and **tested**; no silent commingling of podium pools with admin vault balances.

**Agent prompt (copy-paste):**

```text
Wire Arena v2 buy routing per docs/product/arena-v2.md and docs/onchain/fee-routing-and-governance.md. Implement PodiumVaults and AdminSellVault; TimeArena buy sends 100% to podium vaults (25% × 4 · 70/20/10 epoch tranches; 0% admin on buys). Add tests for routing invariants and governance roles. Document any TODO for AdminSellVault distribution policy.
```

---

<a id="impl-5"></a>

## Implementation phase 5 — Retired: collectible NFTs (Arena v2)

**Status:** Removed [#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241). Historical schema: [`schemas/archive/`](../schemas/archive/), [`schemas/CHANGELOG.md`](../schemas/CHANGELOG.md).

**Goal:** Do not reintroduce without an approved Arena v2 spec.

**Exit criteria**

- No NFT contract, route, or indexer decode path in Arena v2 deploy/indexer/frontend.

**Agent prompt (copy-paste):**

```text
Do not implement collectible NFT contracts for Arena v2 unless explicitly scoped. If reviewing removal, confirm rg is clean outside CHANGELOG/archive and forge/indexer builds are green per GitLab #241.
```

---

<a id="impl-6"></a>

## Implementation phase 6 — Contracts: deployment and address registry

**Docs:** [operations/deployment-stages.md](operations/deployment-stages.md), [operations/deployment-checklist.md](operations/deployment-checklist.md)

**Goal:** Repeatable deploy to **devnet** (scripted or documented), artifact export (addresses, ABIs) for indexer/frontend.

**Deliverables**

- Deploy scripts or Makefile targets; **address registry JSON** template filled for dev runs.
- Optional: verification commands documented in `contracts/README.md`.

**Exit criteria**

- A fresh dev can deploy and get **consistent addresses + ABIs** for downstream wiring.

**Agent prompt (copy-paste):**

```text
Add Foundry script(s) or documented deploy steps for devnet per docs/operations/deployment-stages.md. Export ABIs and an address JSON for indexer consumption. Do not commit secrets. Link to deployment-checklist.md for operators.
```

---

<a id="impl-7"></a>

## Implementation phase 7 — Indexer: schema, decoders, ingestion

**Docs:** [indexer/design.md](indexer/design.md)

**Goal:** Postgres schema and Rust decoders for **all canonical events** from implemented contracts; ingestion from RPC with configurable start block.

**Deliverables**

- Migrations applied cleanly from empty DB.
- Decoders tested against **fixture logs** or local `anvil`/`forge` runs.

**Exit criteria**

- Stage 1 **indexer** unit tests in [testing/strategy.md](testing/strategy.md) green (`cargo test`).

**Agent prompt (copy-paste):**

```text
Wire indexer/ to real ABIs from contracts/artifacts. Implement Postgres migrations and decoders per docs/indexer/design.md. Index TimeArena Buy / PodiumFunded / PodiumEpochRolled / SeedFunded / AdminVaultFunded and ReferralRegistry events as deployed (idx_arena_* tables). Add unit tests with fixtures. cargo test. AGPL-3.0 on new files.
```

---

<a id="impl-8"></a>

## Implementation phase 8 — Indexer: API and reorg safety

**Docs:** [indexer/design.md](indexer/design.md)

**Goal:** HTTP (or chosen) API serves UI and agents; reorg rollback matches design note.

**Deliverables**

- Endpoints for smoke flows: arena buy history, live podium state, wallet stats, referral CRED as needed.
- Reorg tests or **documented manual reorg** path for Stage 2 sign-off.

**Exit criteria**

- API returns data consistent with chain for devnet smoke scenarios (verified in phase 9).

**Agent prompt (copy-paste):**

```text
Complete indexer API per docs/indexer/design.md. Harden reorg handling in indexer/src/reorg.rs (or equivalent); add tests. Document lag measurement. cargo test.
```

---

<a id="impl-9"></a>

## Implementation phase 9 — Frontend: wallet + real reads

**Docs:** [frontend/design.md](frontend/design.md)

**Goal:** Static Vite app: connect wallet, read balances/state from **RPC + indexer**, no hidden servers as source of truth.

**Deliverables**

- Unified **`/arena`** page calls **real** endpoints or contracts on devnet (TimeArena buys, podium timers, claimCred).
- `.env.example` only for **public** config (chain id, URLs, `VITE_TIME_ARENA_ADDRESS`, `VITE_PODIUM_VAULTS_ADDRESS`, `VITE_ADMIN_SELL_VAULT_ADDRESS`).

**Exit criteria**

- Manual or automated smoke: **connect → view** for each surface without console errors on happy path.

**Agent prompt (copy-paste):**

```text
Wire frontend/ to indexer API and public RPC per docs/frontend/design.md. Use address registry from contracts deploy. No private secrets in repo. Match existing layout. Add minimal tests if Vitest is configured. AGPL-3.0 for new source.
```

---

<a id="impl-10"></a>

## Implementation phase 10 — Stage 2 devnet integration (exit checklist)

**Doc:** [testing/strategy.md](testing/strategy.md) (Stage 2)

**Goal:** Full stack on **dev** chain with fresh DB; smoke E2E and indexer lag acceptable.

**Deliverables**

- Completed checklist: deploy → indexer → **buy → rollPodiumEpoch settlement → claimCred**; lag **N** recorded; reorg exercised once (CI or manual log).

**Exit criteria**

- Every box in **Stage 2 — Exit criteria** in [testing/strategy.md](testing/strategy.md) is checked or waived with maintainer sign-off.
- [testing/invariants-and-business-logic.md](testing/invariants-and-business-logic.md) is up to date with the automated test matrix (contracts, indexer, frontend, simulations) and any known gaps.

**Agent prompt (copy-paste):**

```text
Run full Stage 2 validation per docs/testing/strategy.md. Record deploy commit, contract addresses, indexer version, and smoke steps in docs/operations/deployment-checklist.md or a run log. Fix blockers until exit criteria pass or document waivers.
```

**→ ~75%** when Stage 2 is complete.

---

<a id="impl-11"></a>

## Implementation phase 11 — Stage 3 testnet: verify, soak, registry

**Docs:** [testing/strategy.md](testing/strategy.md) Stage 3, [operations/deployment-stages.md](operations/deployment-stages.md)

**Goal:** Public testnet deployment, explorer verification, soak period, **published address registry** and ABI hashes for agents.

**Deliverables**

- Verified contracts; monitoring hooks (RPC errors, indexer lag, DB health) as minimal as agreed.
- Canonical **address registry JSON** for consumers.

**Exit criteria**

- Stage 3 exit criteria in [testing/strategy.md](testing/strategy.md); security review milestones per [security-and-threat-model.md](onchain/security-and-threat-model.md) as required by maintainers.

**Agent prompt (copy-paste):**

```text
Promote stack to public testnet per docs/operations/deployment-stages.md. Verify contracts on explorer; run soak; publish address registry with ABI hashes. Document monitoring and rollback. Align with docs/onchain/security-and-threat-model.md review gates.
```

**→ ~90%** when Stage 3 is complete.

---

<a id="impl-12"></a>

## Implementation phase 12 — Production (mainnet) and 100%

**Docs:** [operations/deployment-stages.md](operations/deployment-stages.md)

**Goal:** Mainnet (or production) deployment with **timelocks/governance** as designed, **incident** path, and **rollback** note.

**Deliverables**

- Deployment checklist row **filled** for mainnet; **audited commit hash** recorded.
- Pause/circuit behavior tested on testnet if applicable.

**Exit criteria**

- [testing/strategy.md](testing/strategy.md) production expectations: mainnet matches audited artifact; ops runbook acknowledged.

**Agent prompt (copy-paste):**

```text
Execute mainnet deployment per docs/operations/deployment-stages.md only after testnet sign-off. Record multisig txs, addresses, indexer/frontend digests, and rollback steps. Update README status from early to production for shipped components.
```

**→ 100%** when production checklist and audit/sign-off requirements are met.

---

## Mapping: planning phases → implementation

| [agent-phases.md](agent-phases.md) | Implementation focus |
|-----------------------------------|----------------------|
| Phases 1–10 | Preconditions; no duplicate—**re-read** before impl-2–5 (TimeArena authority; Rabbit Treasury retired — [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274)) |
| Phase 11 (Foundry) | **impl-1** … **impl-6** |
| Phase 12 (Indexer) | **impl-7** … **impl-8** |
| Phase 13 (Frontend) | **impl-9** |
| Phase 14 (Testing) | **Every phase** + **impl-10** … **impl-12** |
| Phase 15 (Deployment) | **impl-6**, **impl-11**, **impl-12** |

---

## Suggested execution order

```text
impl-0 → impl-1 → impl-2 → impl-3 → impl-4 → impl-5 → impl-6
                    ↓
              impl-7 → impl-8 → impl-9 → impl-10 → impl-11 → impl-12
```

Parallelism: **impl-7** can start once **impl-2** events are stable (fixture ABIs); full **impl-8** API needs **impl-6** addresses.

---

**Agent skill:** follow [`.cursor/skills/yieldomega-guardrails/SKILL.md`](../.cursor/skills/yieldomega-guardrails/SKILL.md) for repo-wide rules.

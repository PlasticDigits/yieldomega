# Agent implementation phases (0% → 100%)

This document is the **code-delivery roadmap** after [`agent-phases.md`](agent-phases.md) planning is complete. Where **agent-phases** ties each step to documentation and design prompts, **implementation phases** tie work to **mergeable artifacts**, **tests**, and **promotion gates** in [`testing/strategy.md`](testing/strategy.md) and [`operations/deployment-stages.md`](operations/deployment-stages.md).

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
| impl-1 … impl-5 | Libraries, TimeCurve, RabbitTreasury, fee router + sinks, Leprechaun NFT | Implemented under `contracts/src/` with matching tests in `contracts/test/` |
| impl-6 | Deploy + address registry | [`DeployDev.s.sol`](../contracts/script/DeployDev.s.sol), [`dev-addresses.example.json`](../contracts/deployments/dev-addresses.example.json), [`stage2-anvil-registry.json`](../contracts/deployments/stage2-anvil-registry.json), [`contracts/deployments/README.md`](../contracts/deployments/README.md) |
| impl-7 … impl-8 | Indexer schema, decoders, API, reorg | `indexer/` migrations + `cargo test` (incl. Postgres rollback integration when `YIELDOMEGA_PG_TEST_URL` is set in CI) |
| impl-9 | Frontend wallet + reads | `frontend/` + [`frontend/.env.example`](../frontend/.env.example) |
| impl-10 | Stage 2 exit checklist | [testing/strategy.md](testing/strategy.md) Stage 2 boxes checked; evidence [operations/stage2-run-log.md](operations/stage2-run-log.md) |
| impl-11 | Stage 3 testnet | **Operator-run** — runbook [operations/stage3-mainnet-operator-runbook.md](operations/stage3-mainnet-operator-runbook.md) §Stage 3 |
| impl-12 | Mainnet + audit | **Operator-run** — same runbook §Mainnet; record audited commit in checklist |

**Contracts (~25% row):** Foundry stack implements core mechanics — [`TimeCurve`](../contracts/src/TimeCurve.sol), [`RabbitTreasury`](../contracts/src/RabbitTreasury.sol) (with [`BurrowMath`](../contracts/src/libraries/BurrowMath.sol)), [`FeeRouter`](../contracts/src/FeeRouter.sol) and fee sinks, [`LeprechaunNFT`](../contracts/src/LeprechaunNFT.sol), shared libs ([`TimeMath`](../contracts/src/libraries/TimeMath.sol), [`FeeMath`](../contracts/src/libraries/FeeMath.sol)); **Stage 1** contract tests green via `forge test` (CI: `FOUNDRY_PROFILE=ci` per [testing/ci.md](testing/ci.md)); dev deploy via [`DeployDev.s.sol`](../contracts/script/DeployDev.s.sol) and [`contracts/deployments/dev-addresses.example.json`](../contracts/deployments/dev-addresses.example.json). Parameter checklist: [`contracts/PARAMETERS.md`](../contracts/PARAMETERS.md).

**~50% row (indexer + frontend reads):** Rust [**indexer**](../indexer/) decodes canonical TimeCurve / RabbitTreasury / Leprechaun events via `sol!` definitions, persists to Postgres ([`migrations/`](../indexer/migrations/)), runs JSON-RPC ingestion with reorg rollback ([`ingestion.rs`](../indexer/src/ingestion.rs), [`reorg.rs`](../indexer/src/reorg.rs)), and exposes versioned HTTP endpoints + CORS ([`api.rs`](../indexer/src/api.rs)). Vite [**frontend**](../frontend/) reads contract state via wagmi/viem and optional indexer URLs configured in [`frontend/.env.example`](../frontend/.env.example).

**~75% row (Stage 2 devnet integration):** Exit checklist in [testing/strategy.md](testing/strategy.md) is **satisfied** with evidence in [**operations/stage2-run-log.md**](operations/stage2-run-log.md) (deploy + fresh DB + smoke txs + lag + history). **Reorg:** Postgres integration tests exercise `rollback_after` in CI (see `indexer/tests/integration_stage2.rs`); optional **live Anvil reorg drill** remains in [indexer/REORG_STRATEGY.md](../indexer/REORG_STRATEGY.md). **Verification:** run the full matrix in [testing/invariants-and-business-logic.md](testing/invariants-and-business-logic.md) before claiming this milestone. **Next milestone (~90%):** execute Stage 3 per [operations/stage3-mainnet-operator-runbook.md](operations/stage3-mainnet-operator-runbook.md) and [testing/strategy.md](testing/strategy.md) Stage 3.

---

<a id="impl-0"></a>

## Implementation phase 0 — Lock parameters and interfaces

**Goal:** Freeze or explicitly **TODO** every numeric policy and external dependency called out in [product/primitives.md](product/primitives.md), [product/rabbit-treasury.md](product/rabbit-treasury.md), [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md), and [research/stablecoin-and-reserves.md](research/stablecoin-and-reserves.md).

**Deliverables**

- Written list (issue or short `contracts/README.md` / design note): timer caps, purchase multiples, fee weights, reserve asset allowlist for v1, governance addresses vs placeholders.
- JSON metadata alignment with [schemas/README.md](schemas/README.md) if NFT work starts soon.

**Exit criteria**

- No contract PR starts with “we’ll pick numbers later” for security-critical fields without a tracked **TODO** and bounds.

**Agent prompt (copy-paste):**

```text
You are implementing Yieldomega on MegaEVM. Read docs/product/primitives.md, docs/product/rabbit-treasury.md, docs/onchain/fee-routing-and-governance.md, and docs/research/stablecoin-and-reserves.md. Produce a single checklist of parameters that need human-fixed values before mainnet, with suggested conservative testnet defaults where safe. Do not write Solidity until the maintainer confirms or defers each item with an explicit TODO location.
```

---

<a id="impl-1"></a>

## Implementation phase 1 — Contracts: shared libraries and tooling

**Docs:** [contracts/foundry-and-megaeth.md](contracts/foundry-and-megaeth.md), [contracts/README.md](../contracts/README.md) (if present)

**Goal:** Foundry project is CI-clean, modularized for MegaEVM constraints, and extends existing math ([`BurrowMath`](../contracts/src/libraries/BurrowMath.sol)) as specs require.

**Deliverables**

- Libraries / helpers used by TimeCurve and Rabbit Treasury (e.g. fixed-point, time math, fee splitting) with **unit tests** and **documented invariants** next to tests.
- `forge test` passes locally and in [CI per docs/testing/ci.md](testing/ci.md).

**Exit criteria**

- Stage 1 **contracts** slice in [testing/strategy.md](testing/strategy.md) is green for this scope.

**Agent prompt (copy-paste):**

```text
Read docs/contracts/foundry-and-megaeth.md and docs/testing/strategy.md Stage 1. Extend contracts/ with shared libraries only—no full game contracts yet. Match style of existing BurrowMath.sol; add tests; run forge test. AGPL-3.0 headers on new files. Small PR.
```

---

<a id="impl-2"></a>

## Implementation phase 2 — Contracts: TimeCurve primitive

**Docs:** [product/primitives.md](product/primitives.md), [onchain/security-and-threat-model.md](onchain/security-and-threat-model.md)

**Goal:** Onchain TimeCurve matches the spec: timer, purchases, fees outbound, sale end, events for indexers.

**Deliverables**

- TimeCurve (or modular equivalent) with **state**, **events**, and **access control** per [fee routing](onchain/fee-routing-and-governance.md).
- **Fuzz / invariant tests** for timer caps, min buy growth, max multiple, and end state per threat model.

**Exit criteria**

- Spec checklist from [agent-phases Phase 6](agent-phases.md#phase-6) is implementable and **checked off** in test names or a short test README.
- `forge test` green.

**Agent prompt (copy-paste):**

```text
Implement the TimeCurve primitive per docs/product/primitives.md and docs/onchain/security-and-threat-model.md. Emit indexer-friendly events. Add fuzz/invariant tests for edge cases. Fee destinations may be placeholder addresses if fee router is not ready—document invariants. Run forge test.
```

---

<a id="impl-3"></a>

## Implementation phase 3 — Contracts: Rabbit Treasury (Burrow)

**Docs:** [product/rabbit-treasury.md](product/rabbit-treasury.md), [onchain/treasury-contracts.md](onchain/treasury-contracts.md)

**Goal:** Player-facing reserve logic: USDm in/out, DOUB mint/burn, repricing using **BurrowMath**, **Burrow\*** events for charts.

**Deliverables**

- **RabbitTreasury** deployment with `AccessControlEnumerable` roles per [treasury-contracts.md](onchain/treasury-contracts.md).
- Integration tests with **BurrowMath**; events match naming in [rabbit-treasury.md](product/rabbit-treasury.md#reserve-health-metrics-and-canonical-events).

**Exit criteria**

- Reserve and repricing paths covered by tests; no offchain-only “truth” for balances.

**Agent prompt (copy-paste):**

```text
Implement RabbitTreasury per docs/product/rabbit-treasury.md and docs/onchain/treasury-contracts.md. Reuse contracts/src/libraries/BurrowMath.sol. Emit Burrow* events as specified. Add integration tests for deposit, withdraw, repricing epoch, and failure cases. forge test.
```

---

<a id="impl-4"></a>

## Implementation phase 4 — Contracts: fee router and treasury sinks

**Docs:** [onchain/fee-routing-and-governance.md](onchain/fee-routing-and-governance.md), [onchain/treasury-contracts.md](onchain/treasury-contracts.md)

**Goal:** Explicit addresses for each fee sink; **post-update invariants** (e.g. weights) enforced onchain or in router logic.

**Deliverables**

- Deployments or modules for **EcosystemTreasury**, **CL8YProtocolTreasury**, **DoubLPIncentives** (or documented **TODO** + non-zero sink for tests as allowed by governance doc).
- Router / wiring from TimeCurve to sinks; tests for invariant violations reverting or emitting as designed.

**Exit criteria**

- Fee split changes are **governed** and **tested**; no silent commingling of player reserves with protocol treasuries.

**Agent prompt (copy-paste):**

```text
Wire fee routing per docs/onchain/fee-routing-and-governance.md and docs/onchain/treasury-contracts.md. Implement separate contract deployments for sinks; router sends to explicit addresses. Add tests for post-update invariants and governance roles. Document any TODO for DoubLPIncentives mechanics.
```

---

<a id="impl-5"></a>

## Implementation phase 5 — Contracts: Leprechaun NFTs

**Docs:** [product/leprechaun-nfts.md](product/leprechaun-nfts.md), [schemas/README.md](schemas/README.md)

**Goal:** ERC-721 (or chosen standard) with onchain metadata fields matching versioned schema; mint constraints and events for indexer.

**Deliverables**

- NFT contract + tests for mint/burn/upgrade rules as specified.
- Schema version bumps documented in [schemas/CHANGELOG.md](schemas/CHANGELOG.md) when fields change.

**Exit criteria**

- Agent-relevant traits are **onchain** or **derivable from onchain** data per product doc.

**Agent prompt (copy-paste):**

```text
Implement Leprechaun NFTs per docs/product/leprechaun-nfts.md and docs/schemas/README.md. Align trait keys with the JSON schema. Add tests for mint limits and metadata visibility. Small PRs; forge test.
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
Wire indexer/ to real ABIs from contracts/artifacts. Implement Postgres migrations and decoders per docs/indexer/design.md. Index TimeCurve, RabbitTreasury Burrow* events, fee/NFT events as deployed. Add unit tests with fixtures. cargo test. AGPL-3.0 on new files.
```

---

<a id="impl-8"></a>

## Implementation phase 8 — Indexer: API and reorg safety

**Docs:** [indexer/design.md](indexer/design.md)

**Goal:** HTTP (or chosen) API serves UI and agents; reorg rollback matches design note.

**Deliverables**

- Endpoints for smoke flows: user history, treasury health fields, NFT metadata pointers as needed.
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

- TimeCurve, Rabbit Treasury, Collection pages call **real** endpoints or contracts on devnet.
- `.env.example` only for **public** config (chain id, URLs, address map).

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

- Completed checklist: deploy → indexer → **buy → deposit → NFT read**; lag **N** recorded; reorg exercised once (CI or manual log).

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
| Phases 1–10 | Preconditions; no duplicate—**re-read** before impl-2–5 |
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

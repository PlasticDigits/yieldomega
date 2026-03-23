# Testing strategy

**CI mapping (what runs in GitHub Actions vs manual gates):** [ci.md](ci.md).

## Three stages (plus production)

Quality gates progress from **fast feedback** to **realistic integration** to **public testnet** before **mainnet**. Shared vocabulary: [../glossary.md](../glossary.md).

### Stage 1 — Unit tests

**Scope**

- **Simulations:** `simulations/` — `PYTHONPATH=. python3 -m unittest discover -s tests -v` for bounded repricing and faction comeback (see [../simulations/README.md](../simulations/README.md)).
- **Contracts:** `forge test` — invariants, edge cases, fuzz on TimeCurve timers and purchase caps; treasury accounting math (`BurrowMath`); NFT mint constraints.
- **Indexer:** Rust unit tests for decoders, reorg rollback logic, schema migrations (where testable without chain).
- **Frontend:** Component and pure logic tests as appropriate (Vitest or similar TBD).

**Entry criteria**

- Code compiles; CI can run tests without secrets.

**Exit criteria**

- No failing tests on default branch.
- Critical invariants documented next to tests; align fee-routing expectations with [post-update invariants](../onchain/fee-routing-and-governance.md#post-update-invariants) in [fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md).

### Stage 2 — Devnet integration

**Scope**

- Deploy contracts to **local** or **MegaETH dev** environment (per tooling availability).
- Run indexer against the dev chain with a **fresh database**.
- **Smoke E2E:** wallet connects, executes a buy, a deposit, and an NFT read path; indexer shows consistent history within expected **lag**.

**Entry criteria**

- Stage 1 green; deployment scripts or documented manual deploy steps exist.

**Exit criteria (checklist)**

- [ ] **Contracts** deployed to the target dev environment; versions/commits recorded (match the branch under test).
- [ ] **Indexer** runs against that chain with a **fresh** Postgres database; migrations applied cleanly from empty.
- [ ] **Smoke E2E** completed: connect wallet → **buy** → **deposit** → **NFT read path**; no blocking failures on these paths.
- [ ] **Indexer lag** is under the agreed threshold (for example **&lt; N blocks** behind tip under normal load); **N** and measurement conditions noted in the run log or ticket.
- [ ] **History consistency:** indexer shows transactions/events that match chain state for the smoke actions (no missing or contradictory rows for those paths).
- [ ] **Reorg handling** exercised at least once: **reorg simulation in CI** *or* **documented manual reorg test** with outcome (pass/fail and what was observed).
- [ ] **No critical regressions** on smoke paths (security or fund-flow breakages block exit until fixed or explicitly waived with sign-off).

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

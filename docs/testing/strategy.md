# Testing strategy

## Three stages (plus production)

Quality gates progress from **fast feedback** to **realistic integration** to **public testnet** before **mainnet**. Shared vocabulary: [../glossary.md](../glossary.md).

### Stage 1 — Unit tests

**Scope**

- **Contracts:** `forge test` — invariants, edge cases, fuzz on TimeCurve timers and purchase caps; treasury accounting math; NFT mint constraints.
- **Indexer:** Rust unit tests for decoders, reorg rollback logic, schema migrations (where testable without chain).
- **Frontend:** Component and pure logic tests as appropriate (Vitest or similar TBD).

**Entry criteria**

- Code compiles; CI can run tests without secrets.

**Exit criteria**

- No failing tests on default branch.
- Critical invariants documented next to tests (for example “fee weights sum to 100%”).

### Stage 2 — Devnet integration

**Scope**

- Deploy contracts to **local** or **MegaETH dev** environment (per tooling availability).
- Run indexer against the dev chain with a **fresh database**.
- **Smoke E2E:** wallet connects, executes a buy, a deposit, and an NFT read path; indexer shows consistent history within expected **lag**.

**Entry criteria**

- Stage 1 green; deployment scripts or documented manual deploy steps exist.

**Exit criteria**

- **Indexer lag** under an agreed threshold (for example **&lt; N blocks** behind tip under normal load).
- **Reorg simulation** at least once in CI or manual checklist (document result).
- No **critical** broken flows on smoke paths.

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

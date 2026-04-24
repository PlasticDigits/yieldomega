# Stage 3 (testnet) and mainnet — operator runbook

This document closes **implementation phases 11 and 12** from [`docs/agent-implementation-phases.md`](../agent-implementation-phases.md) on **live networks**. Nothing here replaces multisig policy, security review, or an **audited commit** for production.

**Related:** [testing/strategy.md](../testing/strategy.md) Stage 3, [deployment-stages.md](deployment-stages.md), [deployment-checklist.md](deployment-checklist.md), [stage2-run-log.md](stage2-run-log.md).

---

## Stage 3 — Public testnet (~90%)

### Entry

- Stage 2 satisfied ([strategy Stage 2](../testing/strategy.md#stage-2--devnet-integration)).
- Security review milestones agreed per [onchain/security-and-threat-model.md](../onchain/security-and-threat-model.md).

### Steps (repeatable)

1. **Deploy** using the same artifact set you intend to promote (tag the git commit). Prefer scripted deploy aligned with [`contracts/script/DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) or a testnet-specific script once parameters are frozen in [`contracts/PARAMETERS.md`](../../contracts/PARAMETERS.md).
2. **Record addresses** in a new row of [deployment-checklist.md](deployment-checklist.md) and publish a **canonical JSON** (copy from [`contracts/deployments/dev-addresses.example.json`](../../contracts/deployments/dev-addresses.example.json), fill all contract keys, `chainId`, `deployBlock`, `gitCommit`).
3. **ABI hashes** — after `forge build`, run [`contracts/script/export_abi_hashes.sh`](../../contracts/script/export_abi_hashes.sh) and merge the printed `abiHashesSha256` object into the published registry so agents can pin ABIs without trusting a mutable URL alone.
4. **Verify** each contract on the chain explorer; store verification tx / links in the checklist.
5. **Indexer** — fresh or migrated DB, `ADDRESS_REGISTRY_PATH` to the published JSON, `START_BLOCK` at deploy block, soak with real RPC.
6. **Frontend** — build with public `VITE_*` env only; record build id / CID in the checklist.
7. **Soak** — run indexer + minimal UI for the agreed duration; log RPC errors, restarts, and head lag (compare `GET /v1/status` to `eth_blockNumber` as in Stage 2). Use [stage3-soak-log.template.md](stage3-soak-log.template.md) as a checklist and attach the completed log to the deployment ticket.
8. **Rollback / pause** — document governance or circuit steps (see [fee-routing-and-governance.md](../onchain/fee-routing-and-governance.md) if applicable). For **gating** user-facing DOUB claims and CL8Y prize/routing before “go live”, use the design inventory in [pause-and-final-signoff.md](pause-and-final-signoff.md) ([issue #55](https://gitlab.com/PlasticDigits/yieldomega/-/issues/55)) and keep **Rabbit Treasury**’s existing `Pausable` surface separate unless the runbook explicitly links them.

### Exit (~90%)

- Stage 3 exit criteria in [testing/strategy.md](../testing/strategy.md#stage-3--testnet-release--final-deployment) met and checklist row complete except fields that intentionally stay blank until mainnet.

---

## Mainnet — production (100%)

### Preconditions

- Testnet sign-off; **audited bytecode** matches the commit you deploy (record **audited commit hash** in [deployment-checklist.md](deployment-checklist.md) and in onchain ops tickets).
- Timelocks / multisig steps per product governance; **pause** behavior exercised on testnet if the design includes it.

### Steps

1. Deploy from the **audited** artifact only; fill the mainnet row in [deployment-checklist.md](deployment-checklist.md) (addresses, verification, signer tx ids, indexer digest, frontend digest).
2. Publish **mainnet address registry JSON** + **ABI hashes** (same procedure as Stage 3).
3. **Incident channel** and **rollback** note in the checklist (what to revert, who can pause, how to point frontend/indexer to last good registry).
4. Post-deploy monitoring: gas anomalies, failed txs, indexer lag — minimal dashboards or log alerts as agreed with maintainers.

### Exit (100% per implementation phases doc)

- [testing/strategy.md](../testing/strategy.md) production expectation: mainnet matches audited artifact; ops runbook acknowledged; checklist row **filled**.

---

**Agent phase:** [Phase 15 — Deployment stages](../agent-phases.md#phase-15)

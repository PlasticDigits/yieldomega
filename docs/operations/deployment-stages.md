# Deployment stages (process)

## Intent

Deployments move **devnet → testnet → mainnet** with **repeatable checklists**, **verified bytecode**, and **recorded addresses** for indexers, frontends, and agents.

## Roles

- **Deployer** — multisig or scripted deployer key with documented permissions.
- **Indexer operator** — applies migrations, sets RPC URL, start block, and contract registry.
- **Frontend operator** — builds static assets with embedded **public** config (chain id, address map).

## Checklist template (copy per release)

For the contracts-to-indexer/frontend deployment guide, start with [deployment-guide.md](deployment-guide.md). For a columnar table (network, contract set version, addresses, verification, indexer, frontend, signers, rollback), use [deployment-checklist.md](deployment-checklist.md). Stage 3 and mainnet execution steps: [stage3-mainnet-operator-runbook.md](stage3-mainnet-operator-runbook.md).

| Field | Value |
|--------|--------|
| Release name / git tag | |
| Audited commit hash | |
| Network (devnet / testnet / mainnet) | |
| Chain ID | |
| RPC URL (internal) | |
| Contract: TimeCurve | Address: … Verified: Y/N Link: … |
| Contract: Rabbit Treasury | Address: … Verified: Y/N Link: … |
| Contract: Leprechaun NFT | Address: … Verified: Y/N Link: … |
| Contract: Fee router / registry | Address: … Verified: Y/N Link: … |
| Indexer migration version | |
| Indexer image / binary digest | |
| Frontend build id / CID | |
| Signers / multisig tx ids | |
| Notes / rollback | |

## Devnet

- Fast iteration; reset allowed.
- Seed test accounts and faucet per MegaETH docs.

## Testnet

- **Public** visibility; treat keys and ops as **security-sensitive**.
- Run **soak** period; publish **address registry** JSON for agents.

## Mainnet

- **Timelocks** and **governance** steps completed.
- **Incident channel** ready; **pause** mechanisms (if any) tested on testnet.
- Post-deployment: monitor **gas anomalies**, **failed txs**, and **indexer lag**.

## Agent prompt reference

Use [Phase 15](../agent-phases.md#phase-15) to generate or extend checklist tables and automation stubs.

---

**Agent phase:** [Phase 15 — Deployment stages](../agent-phases.md#phase-15)

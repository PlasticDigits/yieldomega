# Deployment checklist (tabular template)

Copy this table per release or per environment. Process context: [Deployment stages](deployment-stages.md). Stage 3 / mainnet procedures: [stage3-mainnet-operator-runbook.md](stage3-mainnet-operator-runbook.md).

| network | contract set version | addresses | verification tx | indexer image/tag | frontend build id | signer/multisig | rollback note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **local Anvil (Stage 2 smoke)** | workspace commit per [stage2-run-log.md](stage2-run-log.md) | [stage2-anvil-registry.json](../../contracts/deployments/stage2-anvil-registry.json) | N/A (local) | `yieldomega-indexer` built at same commit | Vite dev / env from run log §3 | Anvil default account (dev only) | Reset chain + DB |
| **public testnet** | _tag / commit TBD_ | _publish JSON + `abiHashesSha256` ([export_abi_hashes.sh](../../contracts/script/export_abi_hashes.sh))_ | _explorer links TBD_ | _image digest TBD_ | _CID / build id TBD_ | _multisig tx ids TBD_ | _pause / registry revert TBD_ |
| **mainnet** | _audited commit hash TBD_ | _canonical registry URL or repo path TBD_ | _explorer links TBD_ | _image digest TBD_ | _CID / build id TBD_ | _multisig tx ids TBD_ | _incident + rollback TBD_ |

## Automation & evidence (repo-local; fill per promotion)

| Gate | Where it runs | What to record |
|------|----------------|----------------|
| Slither (`fail-on: high`) | [`.github/workflows/slither.yml`](../../.github/workflows/slither.yml) | Green workflow run URL on the promoting commit |
| Playwright smoke | `playwright-e2e` job in [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml) | Green job on the same commit as the frontend build |
| Soak window | Manual / ops | Filled [stage3-soak-log.template.md](stage3-soak-log.template.md) (copy per environment) |

Blank rows for additional environments:

| network | contract set version | addresses | verification tx | indexer image/tag | frontend build id | signer/multisig | rollback note |
| --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | |

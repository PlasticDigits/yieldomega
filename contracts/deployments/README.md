# Deployment address registries

Files here are **templates** or **ephemeral dev** snapshots for wiring the indexer (`ADDRESS_REGISTRY_PATH`) and frontend (`VITE_*` addresses).

| File | Purpose |
|------|---------|
| `dev-addresses.example.json` | Copy to a local `dev-addresses.json` (do not commit secrets); fill after `DeployDev` on testnet/mainnet. |
| `stage2-anvil-registry.json` | Example Anvil addresses for Stage 2 smoke; regenerate if deploy order changes. |

## ABI hashes (Stage 3 / mainnet)

Publish **SHA-256** of the compact JSON `.abi` array so agents pin the same interface as your verified contracts:

```bash
cd contracts && ./script/export_abi_hashes.sh
```

Merge the printed JSON object into your published registry under `abiHashesSha256`. The indexer ignores unknown keys; frontends may use the map for integrity checks.

Operator steps: [`docs/operations/stage3-mainnet-operator-runbook.md`](../../docs/operations/stage3-mainnet-operator-runbook.md).

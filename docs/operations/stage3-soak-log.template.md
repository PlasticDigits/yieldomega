# Stage 3 soak log (template)

Copy per testnet soak or mainnet early-watch window. Link the filled copy from [deployment-checklist.md](deployment-checklist.md). Process: [stage3-mainnet-operator-runbook.md](stage3-mainnet-operator-runbook.md).

| Field | Value |
|-------|--------|
| Environment | _testnet name / chain id_ |
| Start (UTC) | _YYYY-MM-DD HH:MM_ |
| End (UTC) | _YYYY-MM-DD HH:MM_ |
| Indexer image / commit | _digest or git SHA_ |
| Frontend build id | _CI run / CID_ |
| RPC endpoint(s) | _provider(s); no secrets in public copies_ |

## Observations (append rows during soak)

| Time (UTC) | Check | Expected | Actual | Notes |
|------------|-------|----------|--------|--------|
| | `GET /v1/status` → `max_indexed_block` vs `eth_blockNumber` | lag ≤ _N_ blocks | | |
| | Indexer process restarts | 0 unplanned | | |
| | RPC 429 / connection errors | none sustained | | |
| | DB connections / pool exhaustion | none | | |
| | Critical contract txs (sample) | success | | |

## Exit

- [ ] Soak duration met
- [ ] No unresolved **high** severity incidents
- [ ] Rollback / pause path rehearsed or documented for this environment

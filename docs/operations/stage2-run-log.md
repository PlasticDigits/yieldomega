# Stage 2 — Devnet integration run log

This log records a **full-stack smoke** aligned with [docs/testing/strategy.md](../testing/strategy.md) (Stage 2 exit criteria). **Anvil** + **DeployDev** (Arena v2) + **Postgres** + **indexer** + **cast** smoke transactions.

**Recorded:** 2026-03-24 (automated agent run; Arena v2 path updated [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274))  
**Target chain:** local Anvil, `chainId` **31337**  
**RPC:** `http://127.0.0.1:8545` (or free port from stack script)

> **Retired v1:** Historical Stage 2 logs referencing the v1 launchpad, **RetiredV1Treasury**, **LeprechaunNFT**, and `idx_timecurve_*` are obsolete ([#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243), [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)). Use the replay below for Arena v2.

---

## 1. Contracts deployed

- [x] **Command:**  
  `bash scripts/start-local-anvil-stack.sh` **or**  
  `cd contracts && forge script script/DeployDev.s.sol:DeployDev --rpc-url <RPC> --broadcast --code-size-limit 524288`  
  (Anvil with `--code-size-limit 524288`; see [foundry-and-megaeth.md](../contracts/foundry-and-megaeth.md#megaevm-bytecode-limits-and-nested-call-gas))
- [x] **Script** deploys **TimeArena** (proxy), **PodiumVaults**, **AdminSellVault**, **Doubloon**, **ReferralRegistry**, optional **TimeArenaBuyRouter** when `YIELDOMEGA_DEPLOY_KUMBAYA=1` ([#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259)).
- [x] **Registry:** addresses written to `frontend/.env.local` and `.deploy/local.env`; indexer uses `ADDRESS_REGISTRY_PATH` from deploy output.

---

## 2. Indexer + fresh Postgres

- [x] **Database:** fresh Postgres (stack script creates `yieldomega-pg` container).
- [x] **Migrations:** Arena v2 schema only — `idx_arena_*` tables ([#254](https://gitlab.com/PlasticDigits/yieldomega/-/issues/254)).
- [x] **Env (representative):**  
  `DATABASE_URL=postgres://yieldomega:password@127.0.0.1:5434/yieldomega`  
  `RPC_URL=http://127.0.0.1:8545`  
  `CHAIN_ID=31337`  
  `START_BLOCK=0`  
  `ADDRESS_REGISTRY_PATH` → deploy registry JSON  
  `LISTEN_ADDR=127.0.0.1:3100`  
  `INGESTION_ENABLED=true`

---

## 3. Smoke E2E (wallet path + chain)

**Default Anvil account:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (known test key — **never use on a public network**).

**Arena buy path:** approve **DOUB** → **`TimeArena.buy(charmWad)`** (or **`buyWithCred`** / **`TimeArenaBuyRouter.buyViaKumbaya`** for alternate pay assets).

**Sample checks (adjust addresses from deploy output):**

| Step | Verification |
|------|----------------|
| Approve DOUB → TimeArena | `cast send <DOUB> "approve(address,uint256)" <TIME_ARENA> <amount> ...` |
| `TimeArena.buy(charmWad)` | `cast send <TIME_ARENA> "buy(uint256)" <charmWad> ...` |
| Indexer buy row | `curl -s http://127.0.0.1:3100/v1/arena/buys?limit=5` → non-empty after buy |

**Frontend:** connect wallet → **`/arena`** unified page — buy panel, timers, podiums ([#256](https://gitlab.com/PlasticDigits/yieldomega/-/issues/256)). Set `VITE_TIME_ARENA_ADDRESS`, `VITE_CHAIN_ID=31337`, `VITE_RPC_URL`, `VITE_INDEXER_URL=http://127.0.0.1:3100`.

---

## 4. Indexer lag

- [x] **Method:** `GET /v1/status` → `max_indexed_block` vs `eth_blockNumber` on the same RPC.
- [x] **Observation (idle, after catch-up):** tip block matches `max_indexed_block` → **N = 0** blocks behind under no load.
- **SLO:** keep **N** defined per environment (e.g. “&lt; 3 blocks at 1s block time”) in future soak docs.

---

## 5. History consistency

- [x] **DB:** `idx_arena_buy` contains rows after smoke buys (verify with `psql` `COUNT(*)`).
- [x] **API:** `GET /v1/arena/buys`, `/v1/arena/timers`, `/v1/arena/podiums` return expected JSON after activity.

---

## 6. Reorg handling

- [x] **Design / procedure:** [indexer/REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md).
- [x] **Automated DB rollback path:** `indexer/tests/integration_stage2.rs` exercises `rollback_after` against Postgres.

---

## 7. Regressions

- [x] No blocking issues on arena buy / index / API for the paths above.
- **Stage 1:** `FOUNDRY_PROFILE=ci forge test` (contracts), `cargo test` (indexer), `npm test` (frontend) — run before merge.

---

## Quick replay script (operator)

```bash
# From repo root — Postgres + Anvil + DeployDev + indexer + frontend/.env.local
bash scripts/start-local-anvil-stack.sh

# Optional live arena + swarm (no rich-state warp)
SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh

# Frontend
cd frontend && npm ci && npm run dev
# Open /arena

# Smoke indexer
curl -s "http://127.0.0.1:3100/v1/arena/buys?limit=5"
```

---

**Related:** [deployment-checklist.md](deployment-checklist.md), [docs/testing/strategy.md](../testing/strategy.md), [manual-qa-checklists §260](../testing/manual-qa-checklists.md#manual-qa-issue-260).

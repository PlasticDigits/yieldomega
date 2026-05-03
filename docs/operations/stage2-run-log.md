# Stage 2 — Devnet integration run log

This log records a **full-stack smoke** aligned with [docs/testing/strategy.md](../testing/strategy.md) (Stage 2 exit criteria). **Anvil** + **DeployDev** + **Postgres** + **indexer** + **cast** smoke transactions.

**Recorded:** 2026-03-24 (automated agent run)  
**Git commit (workspace at recording):** `429c33833febf0fd7b2c425187aa2cb0c7df70d0`  
**Target chain:** local Anvil, `chainId` **31337**  
**RPC used for successful indexer pairing:** `http://127.0.0.1:18545` (port **8545** was busy in the sandbox; default dev is still `8545`.)

---

## 1. Contracts deployed

- [x] **Command:**  
  `cd contracts && forge script script/DeployDev.s.sol:DeployDev --rpc-url <RPC> --broadcast --code-size-limit 524288` (and Anvil with `--code-size-limit 524288`; see [foundry-and-megaeth.md](../contracts/foundry-and-megaeth.md#megaevm-bytecode-limits-and-nested-call-gas))
- [x] **Script** calls `RabbitTreasury.openFirstEpoch()` and **`TimeCurve.startSaleAt(block.timestamp)`** after deploy so **deposit** and **buy** work immediately (**`startSaleAt`** replaces legacy `startSale` — [GitLab #114](https://gitlab.com/PlasticDigits/yieldomega/-/issues/114)).
- [x] **Deterministic addresses** (same mnemonic / deploy order): see [contracts/deployments/stage2-anvil-registry.json](../../contracts/deployments/stage2-anvil-registry.json) for `TimeCurve`, `RabbitTreasury`, `LeprechaunNFT` (template for `ADDRESS_REGISTRY_PATH`).

---

## 2. Indexer + fresh Postgres

- [x] **Database:** new empty DB (e.g. `DROP`/`CREATE DATABASE yieldomega_stage2` or equivalent).
- [x] **Migrations:** applied by indexer on startup (`connect_and_migrate`).
- [x] **Env (representative):**  
  `DATABASE_URL=postgres://yieldomega:password@127.0.0.1:5434/yieldomega_stage2`  
  `RPC_URL=http://127.0.0.1:18545`  
  `CHAIN_ID=31337`  
  `START_BLOCK=0`  
  `ADDRESS_REGISTRY_PATH` → `contracts/deployments/stage2-anvil-registry.json`  
  `LISTEN_ADDR=127.0.0.1:3100`  
  `INGESTION_ENABLED=true`
- [x] **Indexer binary:** `indexer/target/release/yieldomega-indexer` (or `cargo run --release`).

**Fixes validated during this Stage 2 pass**

- `indexer/src/persist.rs` — bind U256 strings into `NUMERIC` columns using `$n::numeric` casts (Postgres type match).
- `indexer/src/api.rs` — `SELECT …::text` for numeric columns so JSON rows are not dropped by `try_get`/`String` mismatch.

---

## 3. Smoke E2E (wallet path + chain)

**Default Anvil account:** `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` (known test key — **never use on a public network**).

**Important:** `TimeCurve.buy` uses `acceptedAsset.transferFrom(buyer, feeRouter, amount)` with **`msg.sender` = TimeCurve**. The buyer must **`approve(TimeCurve, amount)`** on the sale token (not the fee router).

**Sample tx hashes** (one successful run on Anvil `18545` after deploy):

| Step | Tx hash |
|------|---------|
| Approve sale token → TimeCurve | `0x7504b3de812f0230782c0d0c7c8960bec0e5d9fd9e3a16ebac35ccb5a27da49b` |
| `TimeCurve.buy(minAmount)` | `0x67f1a08bcd38b4778879b1ad1d0b99c208064c2da4c0e2d36e004cee57b377ff` |
| Approve reserve → RabbitTreasury | `0x9bb688c7367c181178f4385094be38b85058c95887e468f5134a9a31fe7957dd` |
| `RabbitTreasury.deposit(10e18, 0)` | `0x9a714b97a97e3498329d2d75575280ffee489f0bf6f7b4f030d925c3eef52b0e` |
| `LeprechaunNFT.createSeries` | `0x3538a58c414c7fe917837277b651232b98764ef60a6890728d100ee151a95ed5` |
| `LeprechaunNFT.mint` (traits tuple) | `0x05e2a102a71b75b04ffd909acfcce385750164cf17b170d8f265af53f98a1576` |

**`cast` tips**

- Read min buy without the human suffix:  
  `MIN=$(cast call <TIMECURVE> "currentMinBuyAmount()(uint256)" --rpc-url $RPC | awk '{print $1}')`
- Mint tuple example:  
  `cast send <NFT> "mint(address,(uint256,uint8,uint8,uint8,uint256,uint8,uint8,uint256,uint256,bool,bool,bool))" <TO> "(0,0,0,0,0,0,0,0,0,false,false,false)" ...`

**Frontend:** connect wallet → **TimeCurve** “Buy” → **Rabbit Treasury** “Deposit” → **Collection** (NFT reads + indexer mint feed). Set `VITE_CHAIN_ID=31337`, `VITE_RPC_URL`, contract addresses from deploy, `VITE_INDEXER_URL=http://127.0.0.1:3100`.

---

## 4. Indexer lag

- [x] **Method:** `GET /v1/status` → `max_indexed_block` vs `eth_blockNumber` on the same RPC.
- [x] **Observation (idle, after catch-up):** tip block **16**, `max_indexed_block` **16** → **N = 0** blocks behind under no load.
- **SLO:** keep **N** defined per environment (e.g. “&lt; 3 blocks at 1s block time”) in future soak docs.

---

## 5. History consistency

- [x] **DB:** `idx_timecurve_buy`, `idx_rabbit_deposit`, `idx_nft_minted` each contained **1** row after the smoke txs (verified with `psql` `COUNT(*)`).
- [x] **API:** after `::text` SELECT fix, `GET /v1/timecurve/buys`, `/v1/rabbit/deposits`, `/v1/leprechauns/mints` return non-empty `items` matching those rows (re-verify after any schema change).

---

## 6. Reorg handling

- [x] **Design / procedure:** [indexer/REORG_STRATEGY.md](../../indexer/REORG_STRATEGY.md) (manual Anvil fork / reset; indexer logs `reorg detected` / rollback).
- [x] **Automated DB rollback path:** `indexer/tests/integration_stage2.rs` exercises `rollback_after` against Postgres (all indexed event tables + `indexed_blocks` + `chain_pointer`). Runs in GitHub Actions when `YIELDOMEGA_PG_TEST_URL` is set (see `.github/workflows/unit-tests.yml`).
- [ ] **Live Anvil reorg drill:** optional operator follow-up — run the “Manual reorg check (Stage 2)” subsection once and paste indexer logs here if you need RPC-level confirmation beyond the DB contract tests.

---

## 7. Regressions

- [x] No blocking issues on buy / deposit / mint / index / API for the paths above after persist + API fixes.
- **Stage 1:** `FOUNDRY_PROFILE=ci forge test` (contracts), `cargo test` (indexer; Postgres integration when `YIELDOMEGA_PG_TEST_URL` is set), `npm test` (frontend) — run before merge.

---

## Quick replay script (operator)

```bash
# Terminal A — Anvil (pick a free port)
anvil --host 127.0.0.1 --port 18545 --code-size-limit 524288

# Deploy
cd contracts && forge script script/DeployDev.s.sol:DeployDev \
  --rpc-url http://127.0.0.1:18545 --broadcast --code-size-limit 524288

# Fresh DB + indexer (Terminal B) — adjust DATABASE_URL
export DATABASE_URL=postgres://yieldomega:password@localhost:5434/yieldomega_stage2
export RPC_URL=http://127.0.0.1:18545
export CHAIN_ID=31337
export START_BLOCK=0
export ADDRESS_REGISTRY_PATH=$PWD/contracts/deployments/stage2-anvil-registry.json
export LISTEN_ADDR=127.0.0.1:3100
cd indexer && cargo run --release

# Smoke txs — set reserve (CL8Y), TC, RT, NFT, ACC, PK, RPC from your deploy output
# (see section 3 for approve target = TimeCurve)
```

---

**Related:** [deployment-checklist.md](deployment-checklist.md), [docs/testing/strategy.md](../testing/strategy.md), [docs/testing/ci.md](../testing/ci.md).

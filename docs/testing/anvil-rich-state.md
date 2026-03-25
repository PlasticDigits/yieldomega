# Anvil rich state simulation (indexer + frontend)

This flow drives **TimeCurve**, **RabbitTreasury**, and **LeprechaunNFT** through many onchain events so the **indexer** (see [`indexer/src/decoder.rs`](../../indexer/src/decoder.rs)) and **frontend** panels that call [`GET /v1/...`](../../indexer/src/api.rs) show non-empty data.

## Prerequisites

- Foundry (`anvil`, `forge`, `cast`) on `PATH`
- `jq` (optional but recommended for loading addresses from broadcast JSON)
- [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) already broadcast to the same Anvil RPC

## One-shot script (recommended)

From the repo root (or adjust paths):

```bash
export RPC_URL=http://127.0.0.1:8545
# Deploy stack first (unset USDM_ADDRESS unless you use a real token address)
cd contracts && env -u USDM_ADDRESS forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url "$RPC_URL"
bash contracts/script/anvil_rich_state.sh
```

The script:

1. **`SimulateAnvilRichStatePart1`** — Transfers USDM from the deployer to test accounts, **max-size** TimeCurve buys (avoids stale `minBuy` across broadcast txs), Rabbit deposits + one partial withdraw.
2. **Warps time** past `TimeCurve.deadline` via `anvil_increaseTime` (required because `vm.warp` in `forge script --broadcast` is not replayed on Anvil).
3. **`SimulateAnvilRichStatePart2`** — `endSale`, `claimAllocation` ×4, `distributePrizes`, NFT `createSeries` ×2 + `mint` ×2, `setAlphaWad`.
4. **Three `finalizeEpoch()`** calls on RabbitTreasury with warps to each `epochEnd` (86400s epochs per DeployDev).

`USDM_ADDRESS` for the Forge scripts is taken from **`TimeCurve.acceptedAsset()`** (not from broadcast JSON), so it stays correct even when `MockUSDm` was skipped at deploy time.

## Manual Forge (two parts + shell warps)

```bash
export RPC_URL=http://127.0.0.1:8545
export USDM_ADDRESS=$(cast call "$TIMECURVE_ADDRESS" "acceptedAsset()(address)" --rpc-url "$RPC_URL" | awk '{print $1}')
export TIMECURVE_ADDRESS=0x...
export RABBIT_TREASURY_ADDRESS=0x...
export LEPRECHAUN_NFT_ADDRESS=0x...

cd contracts
forge script script/SimulateAnvilRichState.s.sol:SimulateAnvilRichStatePart1 --rpc-url "$RPC_URL" --broadcast --slow
# Warp past deadline + mine (see anvil_rich_state.sh)
forge script script/SimulateAnvilRichState.s.sol:SimulateAnvilRichStatePart2 --rpc-url "$RPC_URL" --broadcast --slow
```

## Indexer verification (`curl`)

With the indexer listening on e.g. `127.0.0.1:3100` and caught up to the same RPC:

```bash
BASE=http://127.0.0.1:3100
curl -sS "$BASE/v1/status" | jq .
curl -sS "$BASE/v1/timecurve/buys?limit=20" | jq .
curl -sS "$BASE/v1/timecurve/allocation-claims?limit=20" | jq .
curl -sS "$BASE/v1/rabbit/deposits?limit=20" | jq .
curl -sS "$BASE/v1/rabbit/withdrawals?limit=20" | jq .
curl -sS "$BASE/v1/rabbit/health-epochs?limit=10" | jq .
curl -sS "$BASE/v1/leprechauns/mints?limit=20" | jq .
```

Expect multiple rows in buys, deposits, health epochs (after finalizes), allocation claims, mints, and withdrawals if the withdraw path ran.

## Frontend

Point the static build at the same chain and indexer:

- `VITE_RPC_URL`, `VITE_CHAIN_ID=31337`, contract `VITE_*` addresses
- `VITE_INDEXER_URL=http://127.0.0.1:3100` (or your port)

See [`docs/testing/e2e-anvil.md`](e2e-anvil.md) for the `VITE_*` contract.

## Event / address inventory

| Phase | Contracts | Notable decoded events (indexer) |
|-------|-----------|----------------------------------|
| Part1 | TimeCurve, RabbitTreasury | `Buy`, `BurrowDeposited`, `BurrowReserveBalanceUpdated`, `BurrowWithdrawn` |
| Warp + Part2 | TimeCurve, LeprechaunNFT, RabbitTreasury | `SaleEnded`, `AllocationClaimed`, `PrizesDistributed`, `SeriesCreated`, `Minted`, `ParamsUpdated` |
| Shell epochs | RabbitTreasury | `BurrowRepricingApplied`, `BurrowEpochReserveSnapshot`, `BurrowHealthEpochFinalized`, `BurrowEpochOpened` |

FeeRouter `FeesDistributed` / `SinksUpdated` are **not** indexed by the current decoder.

---

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)

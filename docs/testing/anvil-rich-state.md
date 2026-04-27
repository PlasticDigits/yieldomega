# Anvil rich state simulation (indexer + frontend)

This flow drives **TimeCurve**, **RabbitTreasury**, and **LeprechaunNFT** through many onchain events so the **indexer** (see [`indexer/src/decoder.rs`](../../indexer/src/decoder.rs)) and **frontend** panels that call [`GET /v1/...`](../../indexer/src/api.rs) show non-empty data.

## Prerequisites

- Foundry (`anvil`, `forge`, `cast`) on `PATH`. For a **manual** `anvil` (not via [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh)), use **`anvil --code-size-limit 524288`** (512 KiB = **0x80000**; the flag is **decimal**—`0x80000` errors) for MegaEVM parity; default Anvil is **EIP-170** **0x6000** (~24 KiB). **`forge script --broadcast`** also simulates with EIP-170 unless you pass **`--code-size-limit 524288`** on the same command — copy [`start-local-anvil-stack.sh`](../../scripts/start-local-anvil-stack.sh) / [`anvil_rich_state.sh`](../../contracts/script/anvil_rich_state.sh).
- `jq` (optional but recommended for loading addresses from broadcast JSON)
- [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) already broadcast to the same Anvil RPC

**UUPS / broadcast JSON:** After GitLab #54, core contracts deploy behind **ERC1967Proxy**. Foundry’s `run-latest.json` lists the **implementation** `CREATE` as `contractName` `TimeCurve` / `RabbitTreasury` — **not** the address you should call. Prefer **`anvil_rich_state.sh`** defaults (fixed in #61), `scripts/lib/broadcast_proxy_addresses.sh`, or the **console.log** lines from `DeployDev` / `start-local-anvil-stack.sh` — see [invariants — DeployDev broadcast JSON](invariants-and-business-logic.md) ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)).

## One-shot script (recommended)

From the repo root (or adjust paths):

```bash
export RPC_URL=http://127.0.0.1:8545
# Deploy stack first (unset RESERVE_ASSET_ADDRESS / USDM_ADDRESS unless you inject a real token address)
cd contracts && env -u RESERVE_ASSET_ADDRESS -u USDM_ADDRESS forge script script/DeployDev.s.sol:DeployDev --broadcast --rpc-url "$RPC_URL" --code-size-limit 524288
bash contracts/script/anvil_rich_state.sh
```

The script:

1. **`SimulateAnvilRichStatePart1`** — Transfers reserve (**CL8Y**) from the deployer to test accounts, **max-size** TimeCurve buys (avoids stale `minBuy` across broadcast txs), Rabbit deposits + one partial withdraw.
2. **Warps time** past `TimeCurve.deadline` via `anvil_increaseTime` (required because `vm.warp` in `forge script --broadcast` is not replayed on Anvil). **Kumbaya UX:** after a large warp, older frontends could hit router **`Expired()`** on wall-clock swap deadlines; the app aligns deadlines to **head `block.timestamp`** ([issue #83](https://gitlab.com/PlasticDigits/yieldomega/-/issues/83), [kumbaya.md — Option B](../integrations/kumbaya.md#qa-anvil-time-warp-and-swap-deadline-issue-83)).
3. **`SimulateAnvilRichStatePart2`** — `endSale`, `redeemCharms` ×4, `distributePrizes`, NFT `createSeries` ×2 + `mint` ×2, `setAlphaWad`.
4. **Three `finalizeEpoch()`** calls on RabbitTreasury with warps to each `epochEnd` (86400s epochs per DeployDev).

`RESERVE_ASSET_ADDRESS` (and legacy `USDM_ADDRESS`) for the Forge scripts are taken from **`TimeCurve.acceptedAsset()`** (not from broadcast JSON), so they stay correct when a fixed address was injected at deploy time.

## Post-end gate walkthrough (issue #55 / [GitLab #79](https://gitlab.com/PlasticDigits/yieldomega/-/issues/79))

**Why a separate path:** the default one-shot (below) runs **`SimulateAnvilRichStatePart2`**, which calls `setCharmRedemptionEnabled(true)`, `setReservePodiumPayoutsEnabled(true)`, and completes redemptions and prize distribution. That is ideal for **indexer** and **E2E** but **precludes** the “gate off” revert checks on the same chain state. [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) also enables both post-end flags for Anvil convenience; the end-sale-only script resets them to `false` before `endSale()`.

1. **Setup (reproducible):** from repo root, with Anvil and DeployDev (proxy addresses in env or `run-latest.json`):
   ```bash
   export RPC_URL=http://127.0.0.1:8545
   ANVIL_RICH_END_SALE_ONLY=1 bash contracts/script/anvil_rich_state.sh
   ```
2. **Verify four rows (cast + revert strings / success):** [`scripts/verify-timecurve-post-end-gates-anvil.sh`](../../scripts/verify-timecurve-post-end-gates-anvil.sh)
3. **Authoritative spec:** [final-signoff and value movement](../operations/final-signoff-and-value-movement.md#post-end-gate-live-walkthrough-issues-55--gitlab-79) · invariants: [TimeCurve post-end gates — live Anvil](invariants-and-business-logic.md#timecurve-post-end-gates-live-anvil-gitlab-79) · play skill: [`skills/verify-yo-timecurve-post-end-gates/SKILL.md`](../../skills/verify-yo-timecurve-post-end-gates/SKILL.md).

**Manual fallback:** if the script fails, follow the same `cast` sequence in the script header; confirm `podiumPool` CL8Y balance is non-zero before expecting the `TimeCurve: reserve podium payouts disabled` revert.

## Manual Forge (two parts + shell warps)

```bash
export RPC_URL=http://127.0.0.1:8545
export RESERVE_ASSET_ADDRESS=$(cast call "$TIMECURVE_ADDRESS" "acceptedAsset()(address)" --rpc-url "$RPC_URL" | awk '{print $1}')
export USDM_ADDRESS="${RESERVE_ASSET_ADDRESS}"
export TIMECURVE_ADDRESS=0x...
export RABBIT_TREASURY_ADDRESS=0x...
export LEPRECHAUN_NFT_ADDRESS=0x...

cd contracts
forge script script/SimulateAnvilRichState.s.sol:SimulateAnvilRichStatePart1 --rpc-url "$RPC_URL" --broadcast --slow --code-size-limit 524288
# Warp past deadline + mine (see anvil_rich_state.sh)
forge script script/SimulateAnvilRichState.s.sol:SimulateAnvilRichStatePart2 --rpc-url "$RPC_URL" --broadcast --slow --code-size-limit 524288
```

## Indexer verification (`curl`)

With the indexer listening on e.g. `127.0.0.1:3100` and caught up to the same RPC:

```bash
BASE=http://127.0.0.1:3100
curl -sS "$BASE/v1/status" | jq .
curl -sS "$BASE/v1/timecurve/buys?limit=20" | jq .
curl -sS "$BASE/v1/timecurve/charm-redemptions?limit=20" | jq .
curl -sS "$BASE/v1/rabbit/deposits?limit=20" | jq .
curl -sS "$BASE/v1/rabbit/withdrawals?limit=20" | jq .
curl -sS "$BASE/v1/rabbit/health-epochs?limit=10" | jq .
curl -sS "$BASE/v1/leprechauns/mints?limit=20" | jq .
```

Expect multiple rows in buys, deposits, health epochs (after finalizes), charm redemptions, mints, and withdrawals if the withdraw path ran.

## Frontend

Point the static build at the same chain and indexer:

- `VITE_RPC_URL`, `VITE_CHAIN_ID=31337`, contract `VITE_*` addresses
- `VITE_INDEXER_URL=http://127.0.0.1:3100` (or your port)

See [`docs/testing/e2e-anvil.md`](e2e-anvil.md) for the `VITE_*` contract.

## Event / address inventory

| Phase | Contracts | Notable decoded events (indexer) |
|-------|-----------|----------------------------------|
| Part1 | TimeCurve, RabbitTreasury | `Buy`, `BurrowDeposited`, `BurrowReserveBalanceUpdated`, `BurrowWithdrawn` |
| Warp + Part2 | TimeCurve, LeprechaunNFT, RabbitTreasury | `SaleEnded`, `CharmsRedeemed`, `PrizesDistributed`, `SeriesCreated`, `Minted`, `ParamsUpdated` |
| Shell epochs | RabbitTreasury | `BurrowRepricingApplied`, `BurrowEpochReserveSnapshot`, `BurrowHealthEpochFinalized`, `BurrowEpochOpened` |

FeeRouter `FeesDistributed` / `SinksUpdated` are **not** indexed by the current decoder.

---

**Agent phase:** [Phase 14 — Testing strategy](../agent-phases.md#phase-14)

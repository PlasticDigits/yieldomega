# Deployment guide

This guide is the contracts-to-production handoff for YieldOmega. The quickstart deploys **smart contracts only** and writes an address registry. The later sections explain how operators take that registry and configure the indexer and frontend.

Authoritative game rules and balances remain onchain. The indexer and frontend only consume the contract addresses and public chain settings emitted by the deploy.

## Quickstart: MegaETH Mainnet Contracts

Run from the repository root. The script defaults to:

- RPC: `https://mainnet.megaeth.com/rpc`
- Chain ID: `4326`
- Network label: `megaeth_mainnet`
- Final owner / admin / governance address: CL8Y manager `0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c`

It prompts for the deployer private key as hidden input, prompts for the Etherscan API key, prompts for the CL8Y / reserve token address when not exported, and consumes the required sale start timestamp as a Unix epoch number.

```bash
scripts/deploy-megaeth-contracts.sh 1770000000
```

That single command performs a contracts-only deployment and writes two local artifacts under `.deploy/`:

- `yieldomega-megaeth_mainnet-<timestamp>.log` — full Forge output.
- `yieldomega-megaeth_mainnet-<timestamp>.json` — address registry for indexer and frontend operators.

Before running it on mainnet, confirm the deployer has native MegaETH gas, the CL8Y / reserve token address is final, the sale start epoch is in the future on the target chain, and the audited git commit is checked out.

## Required Inputs

The quickstart is interactive, but every input can also be exported for repeatable operator shells:

```bash
export SALE_START_EPOCH=1770000000
export RESERVE_ASSET_ADDRESS=0x...
export ETHERSCAN_API_KEY=...
scripts/deploy-megaeth-contracts.sh
```

`PRIVATE_KEY` may also be exported, but the safer default is to let the script prompt for it as hidden input. The script derives the deployer address with `cast wallet address`, verifies the RPC chain ID, checks that the sale epoch is not already in the past, records the first broadcast receipt block as the registry `deployBlock`, and asks for a typed confirmation before broadcasting.

## Common Options

```bash
scripts/deploy-megaeth-contracts.sh 1770000000 \
  --reserve-asset 0x... \
  --admin 0x... \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --chain-id 4326
```

- `--admin 0x...` sets the final owner / admin / governance role holder. If omitted, it defaults to the CL8Y manager `0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c`, not the deployer.
- `--skip-verify` skips Forge explorer verification. Use only when the explorer is unavailable and verify separately afterward.
- `--yes` skips the final typed confirmation. Use only in controlled automation.
- `RPC_URL`, `CHAIN_ID`, and `NETWORK_NAME` override the MegaETH defaults for staging or testnet rehearsals.
- `YIELDOMEGA_SKIP_SIMULATION=1` passes `--skip-simulation` to Forge for MegaEVM tooling edge cases. Prefer normal simulation unless the target RPC/tooling requires the skip.

## Optional Contract Parameters

The deployment script has conservative defaults matching `contracts/PARAMETERS.md`. Override them only with an approved launch parameter sheet.

```bash
export TOTAL_TOKENS_FOR_SALE_WAD=200000000000000000000000000
export TIMECURVE_BUY_COOLDOWN_SEC=300
export REFERRAL_REGISTRATION_BURN_WAD=1000000000000000000
export CHARM_PRICE_BASE_WAD=1000000000000000000
export CHARM_PRICE_DAILY_INCREMENT_WAD=100000000000000000
```

By default, the script deploys a `RabbitTreasuryVault` and uses it as the 10% Rabbit fee sink in `FeeRouter`. This is intentional: `FeeRouter` transfers ERC-20s to sink addresses and does not call `RabbitTreasury.receiveFee`, so direct transfers to `RabbitTreasury` would not update Burrow accounting. To use a pre-approved custody or routing contract instead:

```bash
export RABBIT_FEE_SINK_ADDRESS=0x...
```

Optional presale vesting is enabled by providing comma-separated beneficiary and amount arrays:

```bash
export PRESALE_BENEFICIARIES=0xabc...,0xdef...
export PRESALE_AMOUNTS_WAD=6000000000000000000000,4000000000000000000000
export PRESALE_TOTAL_ALLOCATION_WAD=10000000000000000000000
export START_PRESALE_VESTING=false
export ENABLE_PRESALE_CLAIMS=false
```

Optional single-transaction Kumbaya entry is enabled by providing the production router and WETH addresses:

```bash
export KUMBAYA_SWAP_ROUTER_ADDRESS=0x...
export KUMBAYA_WETH_ADDRESS=0x...
export KUMBAYA_STABLE_TOKEN_ADDRESS=0x...   # optional; omit for ETH-only router support
export CL8Y_PROTOCOL_TREASURY_ADDRESS=0x... # optional; defaults to EcosystemTreasury
```

If `KUMBAYA_SWAP_ROUTER_ADDRESS` is omitted, `TimeCurveBuyRouter` is not deployed and `TimeCurve.timeCurveBuyRouter()` remains zero. The frontend can still use direct CL8Y buys and any two-step Kumbaya flow configured separately.

## What The Script Deploys

The wrapper calls `contracts/script/DeployProduction.s.sol`, not the dev-only `DeployDev.s.sol`.

The production script deploys:

- `Doubloon` (`DOUB`)
- `PodiumPool` proxy
- `DoubLPIncentives` proxy
- `EcosystemTreasury` proxy
- `RabbitTreasury` proxy
- `RabbitTreasuryVault` unless `RABBIT_FEE_SINK_ADDRESS` is provided
- `FeeRouter` proxy
- `ReferralRegistry` proxy
- `LinearCharmPrice` proxy
- `TimeCurve` proxy
- optional `DoubPresaleVesting` proxy
- optional `TimeCurveBuyRouter`
- `LeprechaunNFT`

It wires the core permissions in the same broadcast:

- Grants `RabbitTreasury` the `Doubloon.MINTER_ROLE`.
- Grants `FeeRouter` the `RabbitTreasury.FEE_ROUTER_ROLE`.
- Routes the FeeRouter Rabbit slice to `RabbitTreasuryVault` or `RABBIT_FEE_SINK_ADDRESS`; it does not send that slice directly to `RabbitTreasury` unless explicitly configured.
- Allows the reserve asset through `FeeRouter.setDistributableToken`.
- Sets `PodiumPool.prizePusher` to the `TimeCurve` proxy.
- Mints the TimeCurve sale allocation of DOUB directly to `TimeCurve`.
- Sets `podiumResidualRecipient` and `unredeemedLaunchedTokenRecipient` to `EcosystemTreasury`.
- Optionally wires `DoubPresaleVesting` and `TimeCurveBuyRouter` into `TimeCurve`.
- Opens the first Rabbit Treasury epoch.
- Calls `TimeCurve.startSaleAt(SALE_START_EPOCH)`.
- Hands ownership / admin / governance roles to `DEPLOY_ADMIN_ADDRESS`, which defaults to the CL8Y manager `0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c`.

It does **not** deploy CL8Y, seed Kumbaya pools, start frontend hosting, run indexer migrations, or configure DNS/CDN infrastructure.

## Deployment Output

The registry JSON looks like:

```json
{
  "chainId": 4326,
  "network": "megaeth_mainnet",
  "abiHashesSha256": {},
  "contracts": {
    "CL8Y_reserve": "0x...",
    "Doubloon": "0x...",
    "PodiumPool": "0x...",
    "RabbitTreasuryVault": "0x...",
    "RabbitFeeSink": "0x...",
    "RabbitTreasury": "0x...",
    "FeeRouter": "0x...",
    "TimeCurve": "0x...",
    "TimeCurveBuyRouter": "",
    "LeprechaunNFT": "0x...",
    "LaunchedToken": "0x...",
    "ReferralRegistry": "0x...",
    "DoubPresaleVesting": ""
  },
  "deployer": "0x...",
  "deployBlock": 123456,
  "gitCommit": "..."
}
```

Publish this registry as the canonical deployment artifact for the environment. The indexer ignores unknown keys, so keeping helper entries such as `LinearCharmPrice` is safe.

## Configure The Indexer

Copy the registry to the indexer host or publish it at a path available to the process. The indexer uses the registry for log filters and production safety checks.

```bash
export DATABASE_URL=postgres://...
export RPC_URL=https://mainnet.megaeth.com/rpc
export CHAIN_ID=4326
export START_BLOCK=<registry deployBlock>
export ADDRESS_REGISTRY_PATH=/srv/yieldomega/yieldomega-megaeth_mainnet.json
export INDEXER_PRODUCTION=1
export CORS_ALLOWED_ORIGINS=https://yieldomega.example
```

If `TimeCurveBuyRouter` is deployed and the UI will expose single-transaction ETH / stable buys, keep that address in the registry. To fail closed when it is missing, also set:

```bash
export INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1
```

Then run migrations and start the indexer using the deployment’s normal service manager. Confirm:

```bash
curl https://indexer.example/v1/status
```

`CHAIN_ID` must match the registry `chainId`, `deployBlock` must be greater than zero on MegaETH, and production `DATABASE_URL` must not contain placeholders.

## Configure The Frontend

The frontend only receives public `VITE_*` values at build time. Use the registry fields from the deploy output:

```bash
export VITE_CHAIN_ID=4326
export VITE_RPC_URL=https://mainnet.megaeth.com/rpc
export VITE_INDEXER_URL=https://indexer.example
export VITE_EXPLORER_BASE_URL=https://mega.etherscan.io

export VITE_TIMECURVE_ADDRESS=<contracts.TimeCurve>
export VITE_RABBIT_TREASURY_ADDRESS=<contracts.RabbitTreasury>
export VITE_LEPRECHAUN_NFT_ADDRESS=<contracts.LeprechaunNFT>
export VITE_REFERRAL_REGISTRY_ADDRESS=<contracts.ReferralRegistry>
export VITE_FEE_ROUTER_ADDRESS=<contracts.FeeRouter>
export VITE_DOUB_PRESALE_VESTING_ADDRESS=<contracts.DoubPresaleVesting>
```

If a `TimeCurveBuyRouter` was deployed:

```bash
export VITE_KUMBAYA_TIMECURVE_BUY_ROUTER=<contracts.TimeCurveBuyRouter>
```

For Kumbaya ETH / stable routing, also set the public Kumbaya router, quoter, WETH, stable token, and fee-tier env described in `docs/integrations/kumbaya.md`. Confirm those addresses against Kumbaya’s current MegaETH mainnet artifacts before building.

After setting env, build and publish the frontend from the same git commit recorded in the registry.

## Post-Deploy Checks

Minimum checks before announcing the deployment:

- Confirm every proxy address in the registry is the proxy, not an implementation.
- Confirm explorer verification links for the deployed contracts.
- Confirm `TimeCurve.saleStart()` equals the requested epoch.
- Confirm `TimeCurve.launchedToken()` equals `Doubloon`.
- Confirm `Doubloon.balanceOf(TimeCurve)` is at least `TimeCurve.totalTokensForSale()`.
- Confirm `RabbitTreasury.currentEpochId()` is `1`.
- Confirm `/v1/status` reports the correct chain and indexer progress after startup.
- Confirm the frontend reads the TimeCurve countdown from the deployed chain/indexer and does not point at Anvil defaults.

For launch-time gates, follow `docs/operations/final-signoff-and-value-movement.md`; the deploy keeps post-end redemption and reserve podium payouts disabled until the owner explicitly enables them.

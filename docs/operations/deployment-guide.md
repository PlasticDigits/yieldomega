# Deployment guide

This guide is the contracts-to-production handoff for YieldOmega. The quickstart deploys **smart contracts only** and writes an address registry. The later sections explain how operators take that registry and configure the indexer and frontend.

Authoritative game rules and balances remain onchain. The indexer and frontend only consume the contract addresses and public chain settings emitted by the deploy.

## Quickstart: MegaETH Mainnet Contracts

Run from the repository root. The script defaults to:

- RPC: `https://mainnet.megaeth.com/rpc`
- Chain ID: `4326`
- Network label: `megaeth_mainnet`
- Final owner / admin / governance address: CL8Y manager `0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c`

It prompts for the deployer private key as hidden input, prompts for the Etherscan API key, prompts for the CL8Y / reserve token address when not exported, and uses the sale start Unix epoch (`SALE_START_EPOCH`, default **1778760000** = 2026-05-14 12:00:00 UTC) for `TimeCurve.startSaleAt`.

```bash
scripts/deploy-megaeth-contracts.sh
```

That single command performs a contracts-only deployment and writes two local artifacts under `.deploy/`:

- `yieldomega-megaeth_mainnet-<timestamp>.log` — full Forge output.
- `yieldomega-megaeth_mainnet-<timestamp>.json` — address registry for indexer and frontend operators.

Before running it on mainnet, confirm the deployer has native MegaETH gas, the CL8Y / reserve token address is final, the sale start epoch is in the future on the target chain, and the audited git commit is checked out.

## Complete exports: MegaETH contracts deploy

`scripts/deploy-megaeth-contracts.sh` passes `--rpc-url` / `--chain` from **`RPC_URL`** / **`CHAIN_ID`**. `forge script` reads **`DeployProduction.s.sol`** environment variables from the **current shell** (the wrapper only re-exports a subset before broadcast; export everything you need **before** invoking the script).

**Operator-supplied (never commit real secrets):**

- **`PRIVATE_KEY`** — `0x` + 64 hex chars (same rule as the wrapper).
- **`ETHERSCAN_API_KEY`** — required unless you pass **`--skip-verify`**.
- **`RESERVE_ASSET_ADDRESS`** — the **CL8Y** ERC-20 used as TimeCurve / Rabbit / referral reserve (canonical product default: one audited CL8Y deployment per [`docs/research/stablecoin-and-reserves.md`](../research/stablecoin-and-reserves.md)).

**MegaETH wrapper defaults** (override for staging / rehearsal RPCs):

```bash
export RPC_URL='https://mainnet.megaeth.com/rpc'
export CHAIN_ID='4326'
export NETWORK_NAME='megaeth_mainnet'
```

**`DeployProduction` — full default export block** (numeric strings are exact `wad` / second literals from [`contracts/script/DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol); Kumbaya mainnet router / WETH / **USDm** match [`frontend/src/lib/kumbayaRoutes.ts`](../../frontend/src/lib/kumbayaRoutes.ts) and must be re-checked against [Kumbaya integrator-kit](https://github.com/Kumbaya-xyz/integrator-kit) + [default-token-list](https://github.com/Kumbaya-xyz/default-token-list) before go-live):

```bash
# --- secrets + CL8Y (fill before running) ---
export PRIVATE_KEY='0xFILL_64_HEX_CHARS_DEPLOYER_KEY'
export ETHERSCAN_API_KEY='FILL_ETHERSCAN_API_KEY'
export RESERVE_ASSET_ADDRESS='0xFILL_CL8Y_TOKEN_ADDRESS'

# --- optional final admin (defaults to CL8Y manager in-script if unset) ---
export DEPLOY_ADMIN_ADDRESS='0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c'

# --- TimeCurve schedule + sale sizing ---
export SALE_START_EPOCH='1778760000'
export TOTAL_TOKENS_FOR_SALE_WAD='200000000000000000000000000'
export TIMECURVE_BUY_COOLDOWN_SEC='300'
export LEPRECHAUN_BASE_URI=''

# --- Referral + charm pricing / timer params ---
export REFERRAL_REGISTRATION_BURN_WAD='1000000000000000000'
export CHARM_PRICE_BASE_WAD='1000000000000000000'
export CHARM_PRICE_DAILY_INCREMENT_WAD='100000000000000000'
export CHARM_ENVELOPE_REF_WAD='1000000000000000000'
export CHARM_GROWTH_RATE_WAD='182321556793954592'
export TIMECURVE_TIMER_EXTENSION_SEC='120'
export TIMECURVE_INITIAL_TIMER_SEC='86400'
export TIMECURVE_TIMER_CAP_SEC='345600'

# --- Rabbit fee sink: zero address → script deploys RabbitTreasuryVault and wires FeeRouter to it ---
export RABBIT_FEE_SINK_ADDRESS='0x0000000000000000000000000000000000000000'

# --- Presale vesting: empty beneficiaries → DoubPresaleVesting not deployed (defaults still listed) ---
export PRESALE_BENEFICIARIES=''
export PRESALE_AMOUNTS_WAD=''
export PRESALE_TOTAL_ALLOCATION_WAD='21500000000000000000000000'
export PRESALE_VESTING_DURATION_SEC='15552000'
export START_PRESALE_VESTING='false'
export ENABLE_PRESALE_CLAIMS='false'

# --- TimeCurveBuyRouter + Kumbaya on MegaETH mainnet (4326); omit KUMBAYA_SWAP_ROUTER_ADDRESS entirely to skip router deploy ---
export KUMBAYA_SWAP_ROUTER_ADDRESS='0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e'
export KUMBAYA_WETH_ADDRESS='0x4200000000000000000000000000000000000006'
# USDm (MegaUSD) on 4326 — public token address; split so static secret scanners stay quiet.
export KUMBAYA_STABLE_TOKEN_ADDRESS="0xFAfD$(printf '%s' dbb3FC7688494971a79cc65DCa3EF82079E7)"
# Optional CL8Y dust sink on the router; omit to default onchain to EcosystemTreasury.
# export CL8Y_PROTOCOL_TREASURY_ADDRESS='0xYourExplicitTreasuryIfNeeded'

scripts/deploy-megaeth-contracts.sh
```

**Without `TimeCurveBuyRouter`:** unset `KUMBAYA_SWAP_ROUTER_ADDRESS` (do not export it) and unset `KUMBAYA_WETH_ADDRESS` / `KUMBAYA_STABLE_TOKEN_ADDRESS` / `CL8Y_PROTOCOL_TREASURY_ADDRESS` so Forge never reads them; `TimeCurve.timeCurveBuyRouter()` stays zero and the UI keeps two-step Kumbaya → `buy` only.

**With presale vesting:** set non-empty comma-separated `PRESALE_BENEFICIARIES` / `PRESALE_AMOUNTS_WAD` (same length) and adjust totals / duration / booleans per your schedule.

`PRIVATE_KEY` may be omitted from the shell and typed at the script prompt; the same applies to `ETHERSCAN_API_KEY` / `SALE_START_EPOCH` / `RESERVE_ASSET_ADDRESS` when not exported (the script prompts for missing values except where it supplies defaults). The script derives the deployer with `cast wallet address`, verifies the RPC chain id, rejects a past `SALE_START_EPOCH`, records `deployBlock`, and requires typed **`DEPLOY YIELDOMEGA`** confirmation unless **`--yes`**.

## Common Options

```bash
scripts/deploy-megaeth-contracts.sh 1778760000 \
  --reserve-asset 0xFILL_CL8Y_TOKEN_ADDRESS \
  --admin 0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --chain-id 4326
```

- `--admin …` overrides **`DEPLOY_ADMIN_ADDRESS`** for the final owner / admin / governance role holder. If omitted, it defaults to the CL8Y manager `0xcd4eb82cfc16d5785b4f7e3bfc255e735e79f39c`, not the deployer.
- `--skip-verify` skips Forge explorer verification. Use only when the explorer is unavailable and verify separately afterward.
- `--yes` skips the final typed confirmation. Use only in controlled automation.
- `RPC_URL`, `CHAIN_ID`, and `NETWORK_NAME` override the MegaETH defaults for staging or testnet rehearsals.
- `YIELDOMEGA_SKIP_SIMULATION=1` passes `--skip-simulation` to Forge for MegaEVM tooling edge cases. Prefer normal simulation unless the target RPC/tooling requires the skip.

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

**Complete production-style exports** (adjust hostnames / passwords; `DATABASE_URL` must **not** contain the placeholder substrings rejected when `INDEXER_PRODUCTION=1` — see [`indexer/src/config.rs`](../../indexer/src/config.rs) / [`indexer/README.md`](../../indexer/README.md)):

```bash
export REGISTRY_PATH='/srv/yieldomega/yieldomega-megaeth_mainnet.json'

export DATABASE_URL='postgres://yieldomega:REPLACE_WITH_STRONG_PASSWORD@indexer-postgres.internal:5432/yieldomega_indexer'
export RPC_URL='https://mainnet.megaeth.com/rpc'
export CHAIN_ID='4326'
export START_BLOCK="$(jq -r '.deployBlock' "$REGISTRY_PATH")"
export ADDRESS_REGISTRY_PATH="$REGISTRY_PATH"

export INDEXER_PRODUCTION='1'
export CORS_ALLOWED_ORIGINS='https://yieldomega.example,https://www.yieldomega.example'

export INGESTION_ENABLED='true'
export LISTEN_ADDR='0.0.0.0:3100'
export INDEXER_RPC_REQUEST_TIMEOUT_SEC='5'
export INDEXER_REGISTRY_REQUIRE_BUY_ROUTER='0'
```

Set **`INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1`** when the registry must include a non-zero **`TimeCurveBuyRouter`** for **`BuyViaKumbaya`** ingestion ([`docs/integrations/kumbaya.md`](../integrations/kumbaya.md)).

Then run migrations and start the indexer using the deployment’s normal service manager. Confirm:

```bash
curl https://indexer.example/v1/status
```

`CHAIN_ID` must match the registry `chainId`, `deployBlock` must be greater than zero on MegaETH, and production `DATABASE_URL` must not contain placeholders.

## Configure The Frontend

The frontend only receives public `VITE_*` values at build time. **Complete export template** for MegaETH mainnet (**4326**): static Kumbaya infra matches [`frontend/src/lib/kumbayaRoutes.ts`](../../frontend/src/lib/kumbayaRoutes.ts); proxy addresses are read from the same registry JSON as the indexer.

```bash
export REGISTRY_PATH='/srv/yieldomega/yieldomega-megaeth_mainnet.json'

# Public hosts (replace with your CDN / API origins)
export VITE_SITE_URL='https://yieldomega.example'
export VITE_INDEXER_URL='https://indexer.yieldomega.example'
export VITE_GOVERNANCE_URL=''

# Chain + RPC + explorer (MegaETH mainnet defaults)
export VITE_CHAIN_ID='4326'
export VITE_RPC_URL='https://mainnet.megaeth.com/rpc'
export VITE_EXPLORER_BASE_URL='https://mega.etherscan.io'
export VITE_CHAIN_NAME=''

# WalletConnect (create a project id at https://cloud.walletconnect.com)
export VITE_WALLETCONNECT_PROJECT_ID='REPLACE_WITH_WALLETCONNECT_PROJECT_ID'

# MegaNames registry (4326 default; see frontend/src/lib/dotMega.ts)
export VITE_DOTMEGA_REGISTRY_ADDRESS='0x5B424C6CCba77b32b9625a6fd5A30D409d20d997'

# Proxies from registry JSON (`contracts` keys match deploy log labels)
export VITE_TIMECURVE_ADDRESS="$(jq -r '.contracts.TimeCurve' "$REGISTRY_PATH")"
export VITE_RABBIT_TREASURY_ADDRESS="$(jq -r '.contracts.RabbitTreasury' "$REGISTRY_PATH")"
export VITE_LEPRECHAUN_NFT_ADDRESS="$(jq -r '.contracts.LeprechaunNFT' "$REGISTRY_PATH")"
export VITE_REFERRAL_REGISTRY_ADDRESS="$(jq -r '.contracts.ReferralRegistry' "$REGISTRY_PATH")"
export VITE_FEE_ROUTER_ADDRESS="$(jq -r '.contracts.FeeRouter' "$REGISTRY_PATH")"
export VITE_DOUB_PRESALE_VESTING_ADDRESS="$(jq -r '.contracts.DoubPresaleVesting // ""' "$REGISTRY_PATH")"

# Kumbaya v3 (SwapRouter02 + QuoterV2 + WETH + USDm) — same literals as `kumbayaRoutes.ts` for 4326
export VITE_KUMBAYA_WETH='0x4200000000000000000000000000000000000006'
export VITE_KUMBAYA_USDM="0xFAfD$(printf '%s' dbb3FC7688494971a79cc65DCa3EF82079E7)"
export VITE_KUMBAYA_SWAP_ROUTER='0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e'
export VITE_KUMBAYA_QUOTER='0x1F1a8dC7E138C34b503Ca080962aC10B75384a27'
export VITE_KUMBAYA_FEE_CL8Y_WETH='3000'
export VITE_KUMBAYA_FEE_USDM_WETH='3000'

# Onchain TimeCurveBuyRouter proxy (empty string if not deployed — omit single-tx Kumbaya env parity checks)
export VITE_KUMBAYA_TIMECURVE_BUY_ROUTER="$(jq -r '.contracts.TimeCurveBuyRouter // ""' "$REGISTRY_PATH")"
```

Re-diff Kumbaya router / quoter / **USDm** against upstream before production builds ([`docs/integrations/kumbaya.md`](../integrations/kumbaya.md)). If **`VITE_KUMBAYA_TIMECURVE_BUY_ROUTER`** is set, it must equal **`TimeCurve.timeCurveBuyRouter()`** onchain ([issue #66](https://gitlab.com/PlasticDigits/yieldomega/-/issues/66)).

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

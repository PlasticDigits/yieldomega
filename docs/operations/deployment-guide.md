# Deployment guide

This guide is the contracts-to-production handoff for YieldOmega. The quickstart deploys **smart contracts only** and writes an address registry. The later sections explain how operators take that registry and configure the indexer and frontend.

Authoritative game rules and balances remain onchain. The indexer and frontend only consume the contract addresses and public chain settings emitted by the deploy.

<a id="arena-v2-deploy-gitlab-259"></a>

## Arena v2 deploy (GitLab [#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259))

**Production** uses [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol) via [`scripts/deploy-megaeth-contracts.sh`](../../scripts/deploy-megaeth-contracts.sh). **Local / Anvil** uses [`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) (see [e2e-anvil.md](../testing/e2e-anvil.md)).

### What deploys

| Contract | Role |
|----------|------|
| `Doubloon` | DOUB ERC-20 |
| `PlayCred` | Non-transferable arena CRED |
| `PodiumVaults` | Eight podium prize pools |
| `ReferralRegistry` | UUPS — CL8Y burn to register codes |
| `TimeArena` | UUPS — timers, buys, CRED, XP, WarBow |

**Not deployed:** collectible NFT layer, Rabbit, Presale, v1 launchpad / five-sink CL8Y stacks ([#241](https://gitlab.com/PlasticDigits/yieldomega/-/issues/241)–[#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244)).

**`TimeArenaBuyRouter`** (ETH/USDM entry) is **not** in `DeployProduction`; deploy separately with Kumbaya fixtures on Anvil ([#270](https://gitlab.com/PlasticDigits/yieldomega/-/issues/270)) or wire post-mainnet.

**MegaETH mainnet buy router** — interactive wrapper (hidden keys, typed confirmation). Uses **`forge script`** with **`--code-size-limit 524288`** (MegaEVM); do **not** pass `--code-size-limit` to **`forge create`** (unsupported).

```bash
scripts/deploy-megaeth-buy-router.sh \
  --registry .deploy/yieldomega-megaeth_mainnet-<RUN_ID>.json \
  --update-registry
```

Deploys [`DeployProductionBuyRouter.s.sol`](../../contracts/script/DeployProductionBuyRouter.s.sol), then **`TimeArena.setTimeArenaBuyRouter`** with the admin key. Set **`INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1`** only after the registry includes the new router address.

### DeployDev (Anvil)

[`DeployDev.s.sol`](../../contracts/script/DeployDev.s.sol) wires all core contracts, calls **`startArena()`**, seeds **DOUB / mock CL8Y / CRED** for the Playwright mock wallet, and logs proxy addresses. Buy router: set **`YIELDOMEGA_DEPLOY_KUMBAYA=1`** in [`scripts/lib/anvil_deploy_dev.sh`](../../scripts/lib/anvil_deploy_dev.sh).

```bash
bash scripts/start-local-anvil-stack.sh
# or full E2E:
bash scripts/e2e-anvil.sh
```

### DeployProduction (MegaETH)

```bash
scripts/deploy-megaeth-contracts.sh
```

**DOUB:** Arena v2 reuses the **existing** MegaETH mainnet `Doubloon` at `0xc3654B4f879937B767aFBB64B7C230FF436d2342` (Kumbaya liquidity, presale/airdrop supply). `DeployProduction` does **not** deploy a new DOUB on chain **4326** unless you override `DOUB_ADDRESS`. Non-mainnet rehearsal without `DOUB_ADDRESS` still mints a fresh `Doubloon` for local testing.

**Charm price (GitLab [#303](https://gitlab.com/PlasticDigits/yieldomega/-/issues/303)):** On MegaETH **4326**, [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol) computes **`charmPriceWad`** from **Kumbaya V3 TWAP** (Sir **15-minute** window) on **DOUB/CL8Y (fee 100)** → **CL8Y/WETH (fee 100)** → **WETH/USDm (fee 3000)** — CL8Y is the **TWAP bridge leg**, not the arena settlement token — unless **`ARENA_CHARM_PRICE_WAD`** is set. Dry-run: `bash scripts/compute-arena-charm-price-twap.sh`. **DeployDev / Anvil** keep **`1000e18`**.

**Env (optional — timer/cooldown defaults match [`DeployProduction.s.sol`](../../contracts/script/DeployProduction.s.sol)):**

```bash
export DOUB_ADDRESS='0xc3654B4f879937B767aFBB64B7C230FF436d2342'  # default on 4326
export DEPLOY_ADMIN_ADDRESS='0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c'
# CL8Y_reserve in registry JSON only (Kumbaya TWAP / buy-router context — not wired in DeployProduction):
export RESERVE_ASSET_ADDRESS='0xfBAa45A537cF07dC768c469FfaC4e88208B0098D'
# Omit ARENA_CHARM_PRICE_WAD on mainnet to use Kumbaya TWAP (Sir 15m, #303). Rehearsal override:
# export ARENA_CHARM_PRICE_WAD='1000000000000000000000'
export ARENA_TIMER_EXTENSION_SEC='120'
export ARENA_INITIAL_TIMER_SEC='86400'
export ARENA_TIMER_CAP_SEC='345600'
export ARENA_BUY_COOLDOWN_SEC='300'
export REFERRAL_REGISTRATION_BURN_WAD='1000000000000000000'
export START_ARENA='0'   # set 1 to call startArena() in-script; else owner calls after deploy
```

Registry JSON keys: **`TimeArena`**, **`PodiumVaults`**, **`PlayCred`**, **`ReferralRegistry`**, **`Doubloon`**, optional **`TimeArenaBuyRouter`**. Frontend: **`VITE_TIME_ARENA_ADDRESS`**, **`VITE_PODIUM_VAULTS_ADDRESS`**, **`VITE_REFERRAL_REGISTRY_ADDRESS`**. Legacy **`AdminSellVault`** removed ([#314](https://gitlab.com/PlasticDigits/yieldomega/-/issues/314)).

**Invariants:** [`INV-DEPLOY-259`](../testing/invariants-and-business-logic.md#arena-v2-deploy-gitlab-259) · [`INV-DEPLOY-314`](../testing/invariants-and-business-logic.md#arena-deploy-no-admin-sell-vault-gitlab-314) · Forge: [`DevStackIntegration.t.sol`](../../contracts/test/DevStackIntegration.t.sol).

### QA verification (agent, GitLab [#259](https://gitlab.com/PlasticDigits/yieldomega/-/issues/259))

Recorded **2026-05-30** on `main` @ `ab89966` (QA agent — not manual `@brouie` sign-off).

| Check | Result |
|-------|--------|
| `FOUNDRY_PROFILE=ci forge test --match-contract DevStackIntegration` | **6/6 pass** |
| `bash scripts/e2e-anvil.sh` | DeployDev + Kumbaya OK; **`e2e/anvil-arena-*.spec.ts`** (6 tests: mount, reads, DOUB/ETH wallet writes, CRED buy) — see [e2e-anvil.md](../testing/e2e-anvil.md) ([#260](https://gitlab.com/PlasticDigits/yieldomega/-/issues/260)) |
| `scripts/deploy-megaeth-contracts.sh --help` | Arena v2 env defaults present |
| `scripts/write-production-registry-from-broadcast.sh` (Anvil `DeployProduction` broadcast) | Emits `TimeArena`, `PodiumVaults`, `PlayCred`, `ReferralRegistry`, `Doubloon` |
| `bash scripts/check-megaevm-contract-sizes.sh` (MegaEVM [#72](https://gitlab.com/PlasticDigits/yieldomega/-/issues/72)) | Largest runtime: `TimeArena` **26,222 B** ≪ 512 KiB limit |
| `SKIP_ANVIL_RICH_STATE=1 bash scripts/start-local-anvil-stack.sh` | DeployDev + registry JSON OK; indexer readiness blocked by local Postgres pool timeout in this run (infra — not deploy script) |

---

> **Retired v1 mainnet:** Historical launchpad / presale deploy runbooks — git history before [#274](https://gitlab.com/PlasticDigits/yieldomega/-/issues/274); contracts removed [#243](https://gitlab.com/PlasticDigits/yieldomega/-/issues/243) / [#244](https://gitlab.com/PlasticDigits/yieldomega/-/issues/244).

## Deploy wrapper options

`scripts/deploy-megaeth-contracts.sh` prompts for the deployer private key (hidden input), optional **`ETHERSCAN_API_KEY`**, and typed **`DEPLOY YIELDOMEGA`** confirmation unless **`--yes`**.

```bash
scripts/deploy-megaeth-contracts.sh \
  --admin 0xCd4Eb82CFC16d5785b4f7E3bFC255E735e79F39c \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --chain-id 4326
```

- `--admin …` overrides **`DEPLOY_ADMIN_ADDRESS`** (defaults to CL8Y manager, not deployer).
- `--skip-verify` — explorer unavailable; verify separately afterward.
- `--yes` — skip typed confirmation (automation only).
- `RPC_URL`, `CHAIN_ID`, `NETWORK_NAME` — staging / rehearsal overrides.
- `YIELDOMEGA_SKIP_SIMULATION=1` — MegaEVM tooling edge cases only.

Artifacts under `.deploy/`: `yieldomega-megaeth_mainnet-<timestamp>.log` and `.json` registry.

## Deployment output

Example Arena v2 registry:

```json
{
  "chainId": 4326,
  "network": "megaeth_mainnet",
  "abiHashesSha256": {},
  "contracts": {
    "Doubloon": "0x...",
    "PlayCred": "0x...",
    "PodiumVaults": "0x...",
    "ReferralRegistry": "0x...",
    "TimeArena": "0x...",
    "TimeArenaBuyRouter": ""
  },
  "deployer": "0x...",
  "deployBlock": 123456,
  "gitCommit": "..."
}
```

Publish the written JSON as the canonical artifact; use it as the source of truth for indexer and frontend wiring.

<a id="timearena-uups-upgrade"></a>

## TimeArena UUPS upgrade

**`TimeArena`** is an ERC1967 proxy. Upgrade the **implementation** only — never redeploy the proxy. Storage (timers, scores, vault wiring) lives on the proxy.

### 1. Deploy new implementation

`TimeArena` links the external library **`ArenaCharmPriceTwap`**. Prefer **`forge script`** (auto-links) over bare **`forge create`**:

```bash
cd contracts
export RPC=https://mainnet.megaeth.com/rpc

forge script script/DeployTimeArenaImpl.s.sol:DeployTimeArenaImpl \
  --rpc-url "$RPC" \
  --chain 4326 \
  --broadcast \
  --code-size-limit 524288 \
  --interactive
```

Verify separately (Megascan / Etherscan v2 API):

```bash
forge verify-contract "$NEW_IMPL" \
  src/arena/TimeArena.sol:TimeArena \
  --rpc-url "$RPC" \
  --chain 4326 \
  --verifier etherscan \
  --verifier-url "https://api.etherscan.io/v2/api?chainid=4326" \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

Record the **`TimeArena`** implementation address from the broadcast log as **`NEW_IMPL`**.

**Current verified implementation (MegaETH 4326, 2026-07-04):** [`0xaA298FCf0E3d67c7B4b68ed418C2B90F97CE9077`](https://megascan.com/address/0xaa298fcf0e3d67c7b4b68ed418c2b90f97ce9077#code) behind proxy **`0xba39cea0e5ef6808d8cb926c722877480049e0ee`**. Adds direct-DOUB **`buy(uint256,bool)`** / **`buy(uint256,bytes32,bool)`** overloads for WarBow flag plant. Also recorded in [`indexer/address-registry.megaeth-mainnet.json`](../../indexer/address-registry.megaeth-mainnet.json) → **`implementations.TimeArena`** (metadata only — ingestion uses proxy addresses).

**Manual `forge create` alternative** — deploy the library first, then link:

```bash
forge create src/oracle/ArenaCharmPriceTwap.sol:ArenaCharmPriceTwap … --interactive
# LIB_ADDR from output

forge create src/arena/TimeArena.sol:TimeArena \
  --libraries src/oracle/ArenaCharmPriceTwap.sol:ArenaCharmPriceTwap:$LIB_ADDR \
  … --interactive
```

On MegaETH mainnet you may reuse the library already linked by the current implementation (e.g. `0xDbe78065A39C28fD2E4A77ec3dd6a650A082070e`) when **`ArenaCharmPriceTwap.sol`** is unchanged.

### 2. Upgrade proxy (`owner()` signer)

Plain upgrade (no migration calldata):

```bash
export TIME_ARENA_PROXY="$(jq -r '.contracts.TimeArena' indexer/address-registry.megaeth-mainnet.json)"

scripts/uups-upgrade-timearena-mainnet.sh "$NEW_IMPL"
```

**Reinitializer migration** — when the new implementation adds a `reinitializer` (e.g. **`migrateEpochPodiumScores()`** for per-epoch Time Booster / Defended Streak scoring, 2026-07-03 mainnet upgrade):

```bash
export TIME_ARENA_PROXY="$(jq -r '.contracts.TimeArena' indexer/address-registry.megaeth-mainnet.json)"
MIGRATE_CALLDATA="$(cast calldata "migrateEpochPodiumScores()")"

scripts/uups-upgrade-timearena-mainnet.sh "$NEW_IMPL" "$MIGRATE_CALLDATA"
```

Manual equivalent: `cast send "$TIME_ARENA_PROXY" "upgradeToAndCall(address,bytes)" "$NEW_IMPL" "$MIGRATE_CALLDATA" --rpc-url https://mainnet.megaeth.com/rpc --interactive`

Confirm ERC1967 implementation slot (last 20 bytes = **`NEW_IMPL`**) and smoke-read a new selector if applicable:

```bash
cast storage "$TIME_ARENA_PROXY" 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc --rpc-url https://mainnet.megaeth.com/rpc
cast call "$TIME_ARENA_PROXY" "effectiveEpochTimerSecAdded(address)(uint256)" 0x0000000000000000000000000000000000000001 --rpc-url https://mainnet.megaeth.com/rpc
```

### 3. Optional — retune per-category settlement timers

After an upgrade that adds **`setPodiumTimerConfig`**, owner can adjust prize-settlement bands without another upgrade:

```bash
# Defended Streak (cat 2): +8m/buy, 22m→30m reset, 4d cap, 1d initial
cast send "$TIME_ARENA_PROXY" \
  "setPodiumTimerConfig(uint8,uint256,uint256,uint256,uint256,uint256)" \
  2 480 86400 345600 1320 1800 \
  --rpc-url https://mainnet.megaeth.com/rpc \
  --interactive
```

**Scoring unchanged:** Defended Streak **score** still uses Last Buy remaining **< 15 min** (`DEFENDED_STREAK_WINDOW_SEC = 900`). Per-category timers govern **prize epoch deadlines** only ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)).

Forge: `TimeArena.t.sol::test_setPodiumTimerConfig_*` · Invariant: **`INV-TIME-ARENA-PODIUM-TIMER-SETTER`**.

## Related operations docs

- [Deployment stages](deployment-stages.md) — sequencing across environments.
- [Deployment checklist](deployment-checklist.md) — operator sign-off items beyond this guide.

## Configure The Indexer

Copy the registry to the indexer host or publish it at a path available to the process. The indexer uses the registry for log filters and production safety checks.

**Internet-facing deploys:** follow the [indexer internet-facing checklist](../../indexer/README.md#internet-facing-indexer-gitlab-326) — set **`INDEXER_PRODUCTION=1`**, restrict **`CORS_ALLOWED_ORIGINS`**, use a real **`DATABASE_URL`**, and validate **`ADDRESS_REGISTRY`** before binding a non-loopback **`LISTEN_ADDR`**.

**Complete production-style exports** (adjust hostnames / passwords; `DATABASE_URL` must **not** contain the placeholder substrings rejected when `INDEXER_PRODUCTION=1` — see [`indexer/src/config.rs`](../../indexer/src/config.rs) / [`indexer/README.md`](../../indexer/README.md)):

MegaETH mainnet RPC (comma-separated, tried in order; no spaces around commas). Smoke-checked: chain id **4326**, `eth_blockNumber` OK on all three (2026-06-28).

```bash
export MEGAETH_MAINNET_RPC='https://rpc-megaeth-mainnet.globalstake.io,https://megaeth.drpc.org,https://mainnet.megaeth.com/rpc'
```

```bash
export REGISTRY_PATH='/srv/yieldomega/yieldomega-megaeth_mainnet.json'

export DATABASE_URL='postgres://yieldomega:REPLACE_WITH_STRONG_PASSWORD@indexer-postgres.internal:5432/yieldomega_indexer'
export RPC_URL="$MEGAETH_MAINNET_RPC"
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

Set **`INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1`** when the registry must include a non-zero **`TimeArenaBuyRouter`** for **`BuyViaKumbaya`** ingestion ([`docs/integrations/kumbaya.md`](../integrations/kumbaya.md)).

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

# Chain + RPC + explorer (MegaETH mainnet defaults; comma-separated fallbacks, no spaces)
export MEGAETH_MAINNET_RPC='https://rpc-megaeth-mainnet.globalstake.io,https://megaeth.drpc.org,https://mainnet.megaeth.com/rpc'
export VITE_CHAIN_ID='4326'
export VITE_RPC_URL="$MEGAETH_MAINNET_RPC"
export VITE_EXPLORER_BASE_URL='https://mega.etherscan.io'
export VITE_CHAIN_NAME=''

# WalletConnect (create a project id at https://cloud.walletconnect.com)
export VITE_WALLETCONNECT_PROJECT_ID='REPLACE_WITH_WALLETCONNECT_PROJECT_ID'

# MegaNames registry (4326 default; see frontend/src/lib/dotMega.ts)
export VITE_DOTMEGA_REGISTRY_ADDRESS='0x5B424C6CCba77b32b9625a6fd5A30D409d20d997'

# Proxies from registry JSON (`contracts` keys match deploy log labels)
export VITE_TIME_ARENA_ADDRESS="$(jq -r '.contracts.TimeArena' "$REGISTRY_PATH")"
export VITE_PODIUM_VAULTS_ADDRESS="$(jq -r '.contracts.PodiumVaults' "$REGISTRY_PATH")"
export VITE_REFERRAL_REGISTRY_ADDRESS="$(jq -r '.contracts.ReferralRegistry' "$REGISTRY_PATH")"
export VITE_DOUBLOON_ADDRESS="$(jq -r '.contracts.Doubloon' "$REGISTRY_PATH")"

# Kumbaya v3 (SwapRouter02 + QuoterV2 + WETH + USDm) — same literals as `kumbayaRoutes.ts` for 4326
export VITE_KUMBAYA_WETH='0x4200000000000000000000000000000000000006'
export VITE_KUMBAYA_USDM='0xFAfDdbb3FC7688494971a79cc65DCa3EF82079E7'
export VITE_KUMBAYA_SWAP_ROUTER='0xE5BbEF8De2DB447a7432A47EBa58924d94eE470e'
export VITE_KUMBAYA_QUOTER='0x1F1a8dC7E138C34b503Ca080962aC10B75384a27'
export VITE_KUMBAYA_FEE_CL8Y_WETH='100'
export VITE_KUMBAYA_FEE_USDM_WETH='3000'

# Onchain TimeArenaBuyRouter proxy (empty if not deployed)
export VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER="$(jq -r '.contracts.TimeArenaBuyRouter // ""' "$REGISTRY_PATH")"
```

Re-diff Kumbaya router / quoter / **USDm** against upstream before production builds ([`docs/integrations/kumbaya.md`](../integrations/kumbaya.md)). If **`VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER`** is set, it must equal **`TimeArena.timeArenaBuyRouter()`** onchain ([#251](https://gitlab.com/PlasticDigits/yieldomega/-/issues/251)).

After setting env, build and publish the frontend from the same git commit recorded in the registry.

## Post-Deploy Checks

Minimum checks before announcing the deployment:

- Confirm every proxy address in the registry is the proxy, not an implementation.
- Confirm explorer verification links for deployed contracts.
- Confirm **`TimeArena.started()`** and timer state after **`startArena()`** (or defer if owner starts later).
- Confirm **`PodiumVaults.arena()`** points at the **`TimeArena`** proxy.
- Confirm **`PlayCred`** grants **`MINTER_ROLE`** to **`TimeArena`**.
- Confirm `/v1/status` reports the correct chain and indexer progress after startup.
- Confirm the frontend reads arena timers from the deployed chain/indexer and does not point at Anvil defaults.

For launch-time gates, follow [`final-signoff-and-value-movement.md`](final-signoff-and-value-movement.md) — Arena v2 uses **`TimeArena.paused`** only.

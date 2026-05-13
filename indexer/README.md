# YieldOmega indexer (Rust)

Offchain read model: MegaETH RPC → decoded logs → Postgres → HTTP API. Authoritative state remains onchain ([`docs/architecture/overview.md`](../docs/architecture/overview.md)).

## Configuration

- Copy [`indexer/.env.example`](.env.example) to **`indexer/.env`** (or export the same variables). Never commit real secrets.
- Required env vars: **`DATABASE_URL`**, **`RPC_URL`**, **`CHAIN_ID`**. Optional: **`START_BLOCK`**, **`ADDRESS_REGISTRY_PATH`** (omit when using the committed default registry for the same **`CHAIN_ID`** — see below), **`INGESTION_ENABLED`**, **`LISTEN_ADDR`**, **`INDEXER_RPC_REQUEST_TIMEOUT_SEC`**.

### Ingestion supervision + RPC timeouts (GitLab [#168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168))

<a id="ingestion-supervision--rpc-timeouts-gitlab-168"></a>
**`INV-INDEXER-168`:** The binary **retries** block ingestion with **exponential backoff** (1s → 60s cap) after a **fatal** `ingestion::run` error instead of leaving the HTTP API as a **stale-data zombie** with a dead background task. **JSON-RPC** uses a **reqwest** per-request **timeout** from **`INDEXER_RPC_REQUEST_TIMEOUT_SEC`** (default **5**; clamped **1–120** seconds) for both **ingestion** and the **`/v1/timecurve/chain-timer`** poller. **`GET /v1/status`** (schema **≥ 1.16.1**) exposes **`ingestion_alive`** (whether the configured ingestion task is in its **active** indexing loop — **`false`** when **`INGESTION_ENABLED`** is off or no registry addresses) and **`last_indexed_at_ms`** (wall-clock millis after the last committed indexed block; **0** if none yet). Map: [invariants §168](../docs/testing/invariants-and-business-logic.md#indexer-ingestion-liveness-and-rpc-timeouts-gitlab-168) · [`main.rs`](src/main.rs) · [`ingestion.rs`](src/ingestion.rs) · [`rpc_http.rs`](src/rpc_http.rs) · [`chain_timer.rs`](src/chain_timer.rs) · [`api.rs`](src/api.rs).

### `INDEXER_PRODUCTION`

When **`INDEXER_PRODUCTION`** is **`1`**, **`true`**, or **`yes`** (case-insensitive), the binary enforces stricter runtime rules:

1. **CORS** — **`CORS_ALLOWED_ORIGINS`** must be a non-empty comma-separated list of allowed origins ([`src/cors_config.rs`](src/cors_config.rs)).
2. **Database URL** — **`DATABASE_URL`** must **not** contain placeholder substrings documented in [`src/config.rs`](src/config.rs) (`FORBIDDEN_PRODUCTION_DATABASE_URL_SUBSTRINGS`). This rejects copy-pasted template credentials such as **`CHANGE_ME_BEFORE_DEPLOY`** or the legacy **`:password@`** tutorial pattern ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142), **`INV-INDEXER-142`** in [`docs/testing/invariants-and-business-logic.md`](../docs/testing/invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142)).
3. **Address registry** — [`ensure_production_address_registry`](src/config.rs) / [`validate_address_registry_for_production`](src/config.rs) fail closed on **`ADDRESS_REGISTRY`** JSON vs **`CHAIN_ID`**, invalid or zero proxy strings, empty resolved log-filter addresses when **`INGESTION_ENABLED`** is true, and **`deploy_block == 0`** on non-Anvil chains ([GitLab #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156), **`INV-INDEXER-156`** in [invariants](../docs/testing/invariants-and-business-logic.md#indexer-production-address-registry-fail-closed-gitlab-156)). Optional **`TimeCurveBuyRouter`** stays optional unless **`INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1`** (then the router proxy must be present for **`BuyViaKumbaya`** ingestion — [GitLab #67](https://gitlab.com/PlasticDigits/yieldomega/-/issues/67)).

Omit **`INDEXER_PRODUCTION`** for local stacks (e.g. [`scripts/start-local-anvil-stack.sh`](../scripts/start-local-anvil-stack.sh) exporting **`postgres://yieldomega:password@…`**).

### Default address registry (MegaETH mainnet)

When **`ADDRESS_REGISTRY_PATH`** is **unset** or **empty**, the binary looks for **`address-registry.megaeth-mainnet.json`** next to the `indexer/` crate (same path used at compile time via **`CARGO_MANIFEST_DIR`**). If that file exists **and** its JSON **`chain_id`** equals **`CHAIN_ID`**, it is loaded automatically. Otherwise ingestion behaves as if no registry was configured until you set **`ADDRESS_REGISTRY_PATH`** explicitly.

This keeps Render/Git deploys simple when **`CHAIN_ID=4326`** and the committed registry file is in the repo. For any other chain, set **`ADDRESS_REGISTRY_PATH`** to your registry file.

### Production operator checklist — `ADDRESS_REGISTRY` ([issue #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156))

When **`INDEXER_PRODUCTION=1`** and **`INGESTION_ENABLED`** is not disabled:

- Set **`ADDRESS_REGISTRY_PATH`** to your deployment registry JSON **or** rely on the **default** committed **`address-registry.megaeth-mainnet.json`** when **`CHAIN_ID`** matches that file ([`src/config.rs`](src/config.rs)).
- Confirm **`chain_id`** in that file equals **`CHAIN_ID`**.
- Confirm every mandatory contract key is the **ERC-1967 proxy** address from your deploy artifact, **not** an implementation row ([issue #61](https://gitlab.com/PlasticDigits/yieldomega/-/issues/61)): **`TimeCurve`**, **`RabbitTreasury`**, **`LeprechaunNFT`**, **`FeeRouter`**, **`ReferralRegistry`**, **`PodiumPool`** (alias **`PrizeVault`** in JSON).
- Set **`deploy_block`** to the deployment anchor block (must be **> 0** except on **`CHAIN_ID=31337`** Anvil).
- If the stack serves **`BuyViaKumbaya`** rows, set **`TimeCurveBuyRouter`** or export **`INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=1`** to force the router field populated.

### Verification ([issue #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142))

- With **`INDEXER_PRODUCTION=1`** and a placeholder **`DATABASE_URL`**, `yieldomega-indexer` should exit during config load with an error naming the forbidden substring.
- With a real **`DATABASE_URL`** and required CORS origins, startup succeeds.
- New operators skimming [`.env.example`](.env.example) should see warnings before **`RPC_URL` / `CHAIN_ID`** and about production mode.

### Verification ([issue #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156))

- **`INDEXER_PRODUCTION=1`**, default ingestion, **no** registry (no **`ADDRESS_REGISTRY_PATH`**, no default file, or default **`chain_id`** mismatch) → config load exits non-zero.
- **`INDEXER_PRODUCTION=1`** + registry **`chain_id`** ≠ **`CHAIN_ID`** → exits non-zero.
- **`INDEXER_PRODUCTION=1`** + registry with a **non-empty** invalid address string → exits non-zero (no silent skip).
- Without **`INDEXER_PRODUCTION`**, mismatched **`chain_id`** still **warns** only; invalid strings still warn-and-skip as before.
- Unit tests: `cd indexer && cargo test production_registry_validation` (see [`src/config.rs`](src/config.rs)).

### Render.com and other Git-based hosts

The JSON under **`.deploy/`** on your laptop is **not** on Render until you put it there. **`contracts/broadcast/`** is **gitignored**, so Forge’s `run-latest.json` is not in the repo either.

**`ADDRESS_REGISTRY_PATH`** is optional when you **commit** **`indexer/address-registry.megaeth-mainnet.json`** and run with **`CHAIN_ID=4326`**: the indexer loads that file automatically (see **Default address registry** above). You can still set **`ADDRESS_REGISTRY_PATH`** to override.

If you do set **`ADDRESS_REGISTRY_PATH`**, it must be a path the indexer process can **`read()`** on that machine ([`config.rs`](src/config.rs): `std::fs::read_to_string`). It can be **relative to the process working directory** (whatever directory your Render **Start Command** runs from) or an absolute path.

**Practical pattern (override file)**

1. On your dev machine, generate the registry (e.g. `scripts/write-production-registry-from-broadcast.sh`).
2. Copy the result into the repo under a **stable name**, e.g. **`indexer/address-registry.megaeth-mainnet.json`**, and **commit + push** (these are public contract addresses, not secrets).
3. In Render **Environment**, optionally set **`ADDRESS_REGISTRY_PATH`** to a path that matches your **Start Command** cwd if you do not use the default filename:
   - If the service starts from the **repo root** (common for `rootDir` = repo):  
     `ADDRESS_REGISTRY_PATH=indexer/address-registry.megaeth-mainnet.json`
   - If you **`cd indexer`** before starting the binary: put the file in `indexer/` and use  
     `ADDRESS_REGISTRY_PATH=address-registry.megaeth-mainnet.json`

If you are unsure of cwd, temporarily set the start command to `pwd; ls -la; …` or check Render’s shell docs — the path must resolve from that cwd.

**Alternatives:** Render **Secret Files** (mount a file and point **`ADDRESS_REGISTRY_PATH`** at the mount path), or a **build step** that `curl`s the JSON from private storage — still ends as a filesystem path the binary can read.

## Build and test

From `indexer/`:

```bash
cargo clippy --all-targets -- -D warnings
cargo test
```

Integration tests in `tests/integration_stage2.rs` run only when **`YIELDOMEGA_PG_TEST_URL`** is set (see [CI mapping](../docs/testing/ci.md)).

<a id="public-http-api-error-bodies-gitlab-157"></a>

### Public HTTP API — generic `500` bodies on database failures (GitLab [#157](https://gitlab.com/PlasticDigits/yieldomega/-/issues/157))

**`INV-INDEXER-157`:** Unexpected **`sqlx`** errors on **`GET /v1/...`** routes return **`{ "error": "internal server error" }`** with HTTP **500**. Do not rely on the response body for diagnostics—use server logs (`RUST_LOG`, container logs) where the full error is recorded with a route **`context`** label. Implementation: [`src/api.rs`](src/api.rs) (`internal_db_error_response`). Map: [invariants §157](../docs/testing/invariants-and-business-logic.md#indexer-public-api-500-error-redaction-gitlab-157) · [indexer design](../docs/indexer/design.md#http-api-error-bodies-gitlab-157).

### SQLx migrations

Migrations live under [`migrations/`](migrations/). Ship **paired** **`.up.sql`** and **`.down.sql`** per version so **`sqlx migrate revert`** can roll back a step and **`sqlx migrate run`** can re-apply it without hand-editing **`_sqlx_migrations`** ([GitLab #152](https://gitlab.com/PlasticDigits/yieldomega/-/issues/152) — unredeemed launched-token **`idx_*`** tables, [`invariants §128`](../docs/testing/invariants-and-business-logic.md#timecurve-unredeemed-launch-allocation-sweep-gitlab-128)).

<a id="accesscontrol-zero-admin-gitlab-120"></a>

### AccessControl zero admin (GitLab [#120](https://gitlab.com/PlasticDigits/yieldomega/-/issues/120))

Yieldomega **`AccessControl`** deploy surfaces reject **`admin == address(0)`** before role grants (**`INV-AC-ZERO-ADMIN-120`** in [`docs/testing/invariants-and-business-logic.md`](../docs/testing/invariants-and-business-logic.md#accesscontrol-zero-admin-deployments-gitlab-120)). That check runs in **`constructor` / `initializer`** tx scope: a mistaken zero admin **reverts the deployment** and emits **no** protocol logs for this indexer to decode.

**INV-INDEXER-120-DEPLOY:** Operational safety is **`FOUNDRY_PROFILE=ci forge test`** (**[`AccessControlZeroAdmin.t.sol`](../contracts/test/AccessControlZeroAdmin.t.sol)**) plus confirming the **successful** proxy/implementation deploy txs—not missing rows in Postgres. See [indexer design — same boundary](../docs/indexer/design.md#accesscontrol-zero-admin-gitlab-120).

## Further reading

- [Indexer design](../docs/indexer/design.md)
- [Testing strategy](../docs/testing/strategy.md)
- [QA local full stack](../docs/testing/qa-local-full-stack.md)

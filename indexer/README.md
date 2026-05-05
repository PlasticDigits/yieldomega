# YieldOmega indexer (Rust)

Offchain read model: MegaETH RPC → decoded logs → Postgres → HTTP API. Authoritative state remains onchain ([`docs/architecture/overview.md`](../docs/architecture/overview.md)).

## Configuration

- Copy [`indexer/.env.example`](.env.example) to **`indexer/.env`** (or export the same variables). Never commit real secrets.
- Required env vars: **`DATABASE_URL`**, **`RPC_URL`**, **`CHAIN_ID`**. Optional: **`START_BLOCK`**, **`ADDRESS_REGISTRY_PATH`**, **`INGESTION_ENABLED`**, **`LISTEN_ADDR`**.

### `INDEXER_PRODUCTION`

When **`INDEXER_PRODUCTION`** is **`1`**, **`true`**, or **`yes`** (case-insensitive), the binary enforces stricter runtime rules:

1. **CORS** — **`CORS_ALLOWED_ORIGINS`** must be a non-empty comma-separated list of allowed origins ([`src/cors_config.rs`](src/cors_config.rs)).
2. **Database URL** — **`DATABASE_URL`** must **not** contain placeholder substrings documented in [`src/config.rs`](src/config.rs) (`FORBIDDEN_PRODUCTION_DATABASE_URL_SUBSTRINGS`). This rejects copy-pasted template credentials such as **`CHANGE_ME_BEFORE_DEPLOY`** or the legacy **`:password@`** tutorial pattern ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142), **`INV-INDEXER-142`** in [`docs/testing/invariants-and-business-logic.md`](../docs/testing/invariants-and-business-logic.md#indexer-production-database-url-placeholders-gitlab-142)).

Omit **`INDEXER_PRODUCTION`** for local stacks (e.g. [`scripts/start-local-anvil-stack.sh`](../scripts/start-local-anvil-stack.sh) exporting **`postgres://yieldomega:password@…`**).

### Verification ([issue #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142))

- With **`INDEXER_PRODUCTION=1`** and a placeholder **`DATABASE_URL`**, `yieldomega-indexer` should exit during config load with an error naming the forbidden substring.
- With a real **`DATABASE_URL`** and required CORS origins, startup succeeds.
- New operators skimming [`.env.example`](.env.example) should see warnings before **`RPC_URL` / `CHAIN_ID`** and about production mode.

## Build and test

From `indexer/`:

```bash
cargo clippy --all-targets -- -D warnings
cargo test
```

Integration tests in `tests/integration_stage2.rs` run only when **`YIELDOMEGA_PG_TEST_URL`** is set (see [CI mapping](../docs/testing/ci.md)).

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

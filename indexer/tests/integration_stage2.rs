// SPDX-License-Identifier: AGPL-3.0-or-later

//! Postgres integration: migrations, every non-`Unknown` [`DecodedEvent`] variant persisted,
//! idempotency replay, `rollback_after` truncating rows above the ancestor block (including
//! referral / prize tables), then HTTP API smoke.
//!
//! **When `YIELDOMEGA_PG_TEST_URL` is unset or empty:** the test returns immediately and still
//! **reports `ok`** — it does not connect to Postgres. For real coverage, set the URL (see
//! [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md)
//! and [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml)).
//!
//! Uses one `#[tokio::test]` so parallel test threads do not race on the same database.
//! The same test finishes with HTTP API checks on the shared pool.

use alloy_primitives::{address, Address, B256, U256};
use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::Row;
use tower::ServiceExt;
use yieldomega_indexer::api::{router, AppState};
use yieldomega_indexer::db::connect_and_migrate;
use yieldomega_indexer::decoder::{DecodedEvent, DecodedLog};
use yieldomega_indexer::persist::persist_decoded_log;
use yieldomega_indexer::reorg::{
    load_chain_pointer, rollback_after, save_chain_pointer, upsert_indexed_block, ChainPointer,
};

const CONTRACT: Address = address!("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

fn b256_lo(n: u64) -> B256 {
    let mut b = [0u8; 32];
    b[24..].copy_from_slice(&n.to_be_bytes());
    B256::from(b)
}

fn addr_byte(b: u8) -> Address {
    Address::from([b; 20])
}

fn sample_log(block: u64, tx_id: u64, log_index: u64, event: DecodedEvent) -> DecodedLog {
    DecodedLog {
        block_number: block,
        block_hash: b256_lo(block.saturating_add(10_000)),
        tx_hash: b256_lo(tx_id),
        log_index,
        contract: CONTRACT,
        event,
    }
}

async fn count_where(pool: &sqlx::PgPool, table: &str, block: i64) -> i64 {
    let q = format!("SELECT COUNT(*)::bigint AS c FROM {table} WHERE block_number = $1");
    let row = sqlx::query(&q)
        .bind(block)
        .fetch_one(pool)
        .await
        .unwrap_or_else(|e| panic!("count {table}: {e}"));
    row.try_get::<i64, _>("c").unwrap()
}

fn pg_url() -> Option<String> {
    std::env::var("YIELDOMEGA_PG_TEST_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
}

async fn response_json(response: axum::response::Response) -> Value {
    let body = response.into_body().collect().await.unwrap().to_bytes();
    serde_json::from_slice(&body).expect("response JSON")
}

async fn api_http_smoke(pool: &sqlx::PgPool) {
    let app = router(AppState { pool: pool.clone() });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/healthz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/status")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    assert!(res.headers().get("x-schema-version").is_some());
    let status_json = response_json(res).await;
    assert_eq!(status_json["database_connected"], true);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/rabbit/deposits?limit=5&user=not-an-address")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/rabbit/deposits?limit=5&user=0xgggggggggggggggggggggggggggggggggggggg")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/rabbit/withdrawals?limit=5&user=0xbad")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/timecurve/buyer-stats?buyer=0xbad")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/referrals/applied?limit=5&referrer=0xbad")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    for path in [
        "/v1/timecurve/buys?limit=2",
        "/v1/rabbit/deposits?limit=2",
        "/v1/rabbit/withdrawals?limit=2",
        "/v1/rabbit/health-epochs?limit=2",
        "/v1/timecurve/charm-redemptions?limit=2",
        "/v1/timecurve/prize-distributions?limit=2",
        "/v1/timecurve/prize-payouts?limit=2",
        "/v1/referrals/registrations?limit=2",
        "/v1/referrals/applied?limit=2",
        "/v1/leprechauns/mints?limit=2",
        "/v1/fee-router/sinks-updates?limit=2",
        "/v1/fee-router/fees-distributed?limit=2",
        "/v1/rabbit/faction-stats",
    ] {
        let res = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK, "path {path}");
        let j = response_json(res).await;
        assert!(j["items"].is_array(), "path {path}");
    }

    sqlx::query(
        r#"INSERT INTO idx_timecurve_buy (
            block_number, block_hash, tx_hash, log_index, contract_address,
            buyer, amount, current_min_buy, charm_wad, price_per_charm_wad,
            new_deadline, total_raised_after, buy_index
        ) VALUES (
            42,
            '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            1,
            '0xcccccccccccccccccccccccccccccccccccccccc',
            '0xdddddddddddddddddddddddddddddddddddddddd',
            1, 1, 1, 1, 3, 4, 5
        )"#,
    )
    .execute(pool)
    .await
    .expect("insert api test buy");

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/timecurve/buys?limit=10")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    let items = j["items"].as_array().expect("items");
    assert!(
        items.iter().any(|row| row["block_number"] == "42"),
        "expected seeded row in items: {items:?}"
    );

    let res = app
        .oneshot(
            Request::builder()
                .uri("/v1/timecurve/buyer-stats?buyer=0xdddddddddddddddddddddddddddddddddddddddd")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let stats = response_json(res).await;
    assert_eq!(stats["indexed_charm_weight"], "1");
    assert_eq!(stats["indexed_buy_count"], "1");
    assert_eq!(stats["buyer"], "0xdddddddddddddddddddddddddddddddddddddddd");
}

/// Single test body: persist + reorg + HTTP API on one Postgres database.
#[tokio::test]
async fn postgres_stage2_persist_all_events_and_rollback_after() {
    let Some(url) = pg_url() else {
        eprintln!("integration_stage2: skip (set YIELDOMEGA_PG_TEST_URL)");
        return;
    };

    let pool = connect_and_migrate(&url)
        .await
        .expect("connect_and_migrate");

    // ── A) Every non-Unknown `DecodedEvent` variant persists ───────────────
    let u1 = U256::from(1u8);
    let u2 = U256::from(2u8);
    let alice = addr_byte(0xa1);
    let reserve = addr_byte(0xe5);

    let mut tx_id = 1u64;
    let mut li = 0u64;

    let mut next = |event: DecodedEvent| -> DecodedLog {
        tx_id += 1;
        li += 1;
        sample_log(100, tx_id, li, event)
    };

    let logs = vec![
        next(DecodedEvent::TimeCurveSaleStarted {
            start_timestamp: u1,
            initial_deadline: u2,
            total_tokens_for_sale: U256::from(1_000_000u128 * 10u128.pow(18)),
        }),
        next(DecodedEvent::TimeCurveBuy {
            buyer: alice,
            charm_wad: u1,
            amount: u1,
            price_per_charm_wad: u1,
            new_deadline: u2,
            total_raised_after: u1,
            buy_index: u1,
        }),
        next(DecodedEvent::TimeCurveSaleEnded {
            end_timestamp: u1,
            total_raised: u2,
            total_buys: u1,
        }),
        next(DecodedEvent::TimeCurveCharmsRedeemed {
            buyer: alice,
            token_amount: u1,
        }),
        next(DecodedEvent::TimeCurvePrizesDistributed),
        next(DecodedEvent::TimeCurveReferralApplied {
            buyer: alice,
            referrer: addr_byte(0xee),
            code_hash: b256_lo(77_777),
            referrer_amount: u1,
            referee_amount: u1,
            amount_to_fee_router: u2,
        }),
        next(DecodedEvent::ReferralCodeRegistered {
            owner: alice,
            code_hash: b256_lo(88_888),
            normalized_code: "TESTCODE".to_string(),
        }),
        next(DecodedEvent::PodiumPoolPaid {
            winner: alice,
            token: reserve,
            amount: u2,
            category: 0,
            placement: 1,
        }),
        next(DecodedEvent::RabbitEpochOpened {
            epoch_id: u1,
            start_timestamp: u1,
            end_timestamp: u2,
        }),
        next(DecodedEvent::RabbitHealthEpochFinalized {
            epoch_id: u1,
            finalized_at: u1,
            reserve_ratio_wad: u1,
            doub_total_supply: u2,
            repricing_factor_wad: u1,
            backing_per_doubloon_wad: u1,
            internal_state_e_wad: u1,
        }),
        next(DecodedEvent::RabbitEpochReserveSnapshot {
            epoch_id: u1,
            reserve_asset: reserve,
            balance: u2,
        }),
        next(DecodedEvent::RabbitReserveBalanceUpdated {
            reserve_asset: reserve,
            balance_after: u2,
            delta: "-1000".to_string(),
            reason_code: 1,
        }),
        next(DecodedEvent::RabbitDeposit {
            user: alice,
            reserve_asset: reserve,
            amount: u1,
            doub_out: u1,
            epoch_id: u1,
            faction_id: U256::ZERO,
        }),
        next(DecodedEvent::RabbitWithdrawal {
            user: alice,
            reserve_asset: reserve,
            amount: u1,
            doub_in: u1,
            epoch_id: u1,
            faction_id: U256::ZERO,
        }),
        next(DecodedEvent::RabbitFeeAccrued {
            asset: reserve,
            amount: u1,
            cumulative_in_asset: u2,
            epoch_id: u1,
        }),
        next(DecodedEvent::RabbitRepricingApplied {
            epoch_id: u1,
            repricing_factor_wad: u1,
            prior_internal_price_wad: u1,
            new_internal_price_wad: u2,
        }),
        next(DecodedEvent::RabbitParamsUpdated {
            actor: alice,
            param_name: "test_param".to_string(),
            old_value: u1,
            new_value: u2,
        }),
        next(DecodedEvent::NftSeriesCreated {
            series_id: u1,
            max_supply: u2,
        }),
        next(DecodedEvent::NftMinted {
            token_id: u1,
            series_id: u1,
            to: alice,
        }),
        next(DecodedEvent::FeeRouterSinksUpdated {
            actor: alice,
            old_destinations: [addr_byte(1); 5],
            old_weights: [2500, 3500, 2000, 0, 2000],
            new_destinations: [addr_byte(2); 5],
            new_weights: [2000, 2000, 2000, 2000, 2000],
        }),
        next(DecodedEvent::FeeRouterFeesDistributed {
            token: reserve,
            amount: u2,
            shares: [u1, u1, u1, u1, u2],
        }),
    ];

    for d in &logs {
        persist_decoded_log(&pool, d)
            .await
            .unwrap_or_else(|e| panic!("persist {:?}: {e}", d.event));
    }

    assert_eq!(
        count_where(&pool, "idx_timecurve_sale_started", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_timecurve_sale_ended", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_timecurve_charms_redeemed", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_prizes_distributed", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_referral_applied", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_referral_code_registered", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_podium_pool_paid", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_rabbit_epoch_opened", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_rabbit_health_epoch_finalized", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_rabbit_epoch_reserve_snapshot", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_rabbit_reserve_balance_updated", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_rabbit_deposit", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_rabbit_withdrawal", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_rabbit_fee_accrued", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_rabbit_repricing_applied", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_rabbit_params_updated", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_nft_series_created", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_nft_minted", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_fee_router_sinks_updated", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_fee_router_fees_distributed", 100).await,
        1
    );

    // Idempotency: same (tx_hash, log_index) again
    let first = &logs[1];
    persist_decoded_log(&pool, first).await.expect("replay");
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 100).await, 1);

    // Unknown: no-op, no panic
    let unknown = DecodedLog {
        block_number: 100,
        block_hash: first.block_hash,
        tx_hash: b256_lo(999_001),
        log_index: 999,
        contract: CONTRACT,
        event: DecodedEvent::Unknown { topic0: B256::ZERO },
    };
    persist_decoded_log(&pool, &unknown).await.expect("unknown");

    // ── B) `rollback_after` ─────────────────────────────────────────────
    let h5 = b256_lo(5);
    let h20 = b256_lo(20);
    upsert_indexed_block(&pool, 5, h5).await.expect("upsert 5");
    upsert_indexed_block(&pool, 20, h20)
        .await
        .expect("upsert 20");

    let anc = ChainPointer {
        block_number: 5,
        block_hash: h5,
    };
    save_chain_pointer(
        &pool,
        &ChainPointer {
            block_number: 20,
            block_hash: h20,
        },
    )
    .await
    .expect("save tip");

    let d5 = sample_log(
        5,
        50_001,
        0,
        DecodedEvent::TimeCurveBuy {
            buyer: addr_byte(1),
            charm_wad: U256::from(1u8),
            amount: U256::from(1u8),
            price_per_charm_wad: U256::from(1u8),
            new_deadline: U256::from(2u8),
            total_raised_after: U256::from(1u8),
            buy_index: U256::from(1u8),
        },
    );
    let d20 = sample_log(
        20,
        50_002,
        0,
        DecodedEvent::TimeCurveBuy {
            buyer: addr_byte(2),
            charm_wad: U256::from(1u8),
            amount: U256::from(1u8),
            price_per_charm_wad: U256::from(1u8),
            new_deadline: U256::from(2u8),
            total_raised_after: U256::from(1u8),
            buy_index: U256::from(1u8),
        },
    );
    persist_decoded_log(&pool, &d5).await.expect("d5");
    persist_decoded_log(&pool, &d20).await.expect("d20");

    assert_eq!(count_where(&pool, "idx_timecurve_buy", 5).await, 1);
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 20).await, 1);

    rollback_after(&pool, anc).await.expect("rollback");

    assert_eq!(count_where(&pool, "idx_timecurve_buy", 5).await, 1);
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 20).await, 0);
    // Block 100 batch must be removed (rollback deletes `block_number > ancestor`).
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 100).await, 0);
    assert_eq!(
        count_where(&pool, "idx_timecurve_referral_applied", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_referral_code_registered", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_podium_pool_paid", 100).await,
        0
    );
    assert_eq!(count_where(&pool, "idx_rabbit_deposit", 100).await, 0);

    let row = sqlx::query("SELECT block_number FROM indexed_blocks WHERE block_number = 20")
        .fetch_optional(&pool)
        .await
        .expect("query ib");
    assert!(row.is_none());

    let p = load_chain_pointer(&pool).await.expect("load ptr");
    assert_eq!(p.block_number, 5);
    assert_eq!(p.block_hash, h5);

    // ── C) HTTP API (axum) on same pool ───────────────────────────────────
    api_http_smoke(&pool).await;
}

// SPDX-License-Identifier: AGPL-3.0-or-later

//! Postgres integration: Arena v2 migrations, persist all `DecodedEvent` variants,
//! idempotency, `rollback_after`, and HTTP API smoke (`/v1/arena/*`, `/v1/referrals/*`).

use alloy_primitives::{address, Address, B256, U256};
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::Arc;

use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::Value;
use sqlx::Row;
use tokio::sync::RwLock;
use tower::ServiceExt;
use yieldomega_indexer::api::{router, AppState};
use yieldomega_indexer::chain_timer::{ChainTimerSnapshot, PodiumRpcRow, TimecurveHeadSnapshot};
use yieldomega_indexer::config::DEFAULT_DATABASE_POOL_MAX;
use yieldomega_indexer::db::connect_and_migrate;
use yieldomega_indexer::decoder::{DecodedEvent, DecodedLog, VaultFundingKind};
use yieldomega_indexer::persist::{persist_decoded_log_autocommit, persist_decoded_log_conn};
use yieldomega_indexer::reorg::{
    load_chain_pointer, rollback_after, save_chain_pointer, upsert_indexed_block, ChainPointer,
};
use yieldomega_indexer::sale_state::TimecurveSaleStateSnapshot;

const CONTRACT: Address = address!("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

fn b256_lo(n: u64) -> B256 {
    let mut b = [0u8; 32];
    b[24..].copy_from_slice(&n.to_be_bytes());
    B256::from(b)
}

fn addr_byte(b: u8) -> Address {
    Address::from([b; 20])
}

fn sample_log_tx(block: u64, tx_id: u64, log_index: u64, event: DecodedEvent) -> DecodedLog {
    DecodedLog {
        block_number: block,
        block_hash: b256_lo(block.saturating_add(10_000)),
        tx_hash: b256_lo(tx_id),
        log_index,
        block_timestamp: Some(1_700_000_000),
        contract: CONTRACT,
        event,
    }
}

const DOUB_1000: u128 = 1_000_000_000_000_000_000_000;
const DOUB_100: u128 = 100_000_000_000_000_000_000;
const DOUB_75: u128 = 75_000_000_000_000_000_000;
const DOUB_300: u128 = 300_000_000_000_000_000_000;

fn vault_funding_rows_for_buy_tx(block: u64, tx_id: u64, start_log_index: u64) -> Vec<DecodedLog> {
    let pool = |i: u8| addr_byte(0x50 + i);
    let mut rows = Vec::with_capacity(9);
    let mut li = start_log_index;
    for podium in 0u8..4 {
        li += 1;
        rows.push(sample_log_tx(
            block,
            tx_id,
            li,
            DecodedEvent::ArenaVaultFunding {
                kind: VaultFundingKind::PodiumActive,
                podium_id: Some(podium),
                amount_doub_wad: U256::from(DOUB_100),
                pool_address: Some(pool(podium)),
            },
        ));
    }
    for podium in 0u8..4 {
        li += 1;
        rows.push(sample_log_tx(
            block,
            tx_id,
            li,
            DecodedEvent::ArenaVaultFunding {
                kind: VaultFundingKind::PodiumSeed,
                podium_id: Some(podium),
                amount_doub_wad: U256::from(DOUB_75),
                pool_address: Some(pool(podium)),
            },
        ));
    }
    li += 1;
    rows.push(sample_log_tx(
        block,
        tx_id,
        li,
        DecodedEvent::ArenaVaultFunding {
            kind: VaultFundingKind::Admin,
            podium_id: None,
            amount_doub_wad: U256::from(DOUB_300),
            pool_address: None,
        },
    ));
    rows
}

fn sample_log(block: u64, tx_id: u64, log_index: u64, event: DecodedEvent) -> DecodedLog {
    DecodedLog {
        block_number: block,
        block_hash: b256_lo(block.saturating_add(10_000)),
        tx_hash: b256_lo(tx_id),
        log_index,
        block_timestamp: None,
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

fn arena_head_snapshot() -> TimecurveHeadSnapshot {
    TimecurveHeadSnapshot {
        timer: ChainTimerSnapshot {
            read_block_number: "1".into(),
            block_timestamp_sec: "1".into(),
            polled_at_ms: 0,
            sale_start_sec: "100".into(),
            deadline_sec: "9999".into(),
            timer_cap_sec: "86400".into(),
            last_buy_epoch: "0".into(),
            podium_deadlines_sec: ["1", "2", "3", "4"].map(String::from),
        },
        sale_ended: false,
        sale_state: TimecurveSaleStateSnapshot {
            read_block_number: "1".into(),
            block_timestamp_sec: "1".into(),
            polled_at_ms: 0,
            deadline_sec: "9999".into(),
            total_doub_raised: "0".into(),
            paused: false,
        },
        podium_contract: std::array::from_fn(|i| {
            let w = format!("0x{:040x}", i + 1);
            PodiumRpcRow {
                winners: [w.clone(), w.clone(), w],
                values: ["1".into(), "2".into(), "3".into()],
            }
        }),
    }
}

async fn api_http_smoke(pool: &sqlx::PgPool) {
    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    for path in ["/healthz", "/v1/status"] {
        let res = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK, "{path}");
    }

    for path in [
        "/v1/arena/timers",
        "/v1/arena/podiums",
        "/v1/arena/buys?limit=2",
        "/v1/referrals/registrations?limit=2",
        "/v1/referrals/applied?limit=2",
        "/v1/referrals/referrer-leaderboard?limit=2",
    ] {
        let res = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK, "{path}");
        let j = response_json(res).await;
        assert!(j.get("items").is_some() || j.get("rows").is_some() || j.get("last_buy_deadline_sec").is_some());
    }

    let vb = "0xdddddddddddddddddddddddddddddddddddddddd";
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!("/v1/arena/wallet/{vb}/stats"))
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
                .uri(format!("/v1/referrals/wallet-charm-summary?wallet={vb}"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let res = app
        .oneshot(
            Request::builder()
                .uri("/v1/arena/wallet/0xbad/stats")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn postgres_stage2_persist_all_events_and_rollback_after() {
    let Some(url) = pg_url() else {
        eprintln!("integration_stage2: skip (set YIELDOMEGA_PG_TEST_URL)");
        return;
    };

    let pool = connect_and_migrate(&url, DEFAULT_DATABASE_POOL_MAX)
        .await
        .expect("connect_and_migrate");

    for table in yieldomega_indexer::reorg::ARENA_INDEX_TABLES {
        let q = format!("DELETE FROM {table}");
        sqlx::query(&q).execute(&pool).await.expect("clear index table");
    }
    sqlx::query("DELETE FROM indexed_blocks")
        .execute(&pool)
        .await
        .expect("clear indexed_blocks");
    sqlx::query(
        r#"UPDATE indexer_state SET value = '{"block_number": 0, "block_hash": "0x0000000000000000000000000000000000000000000000000000000000000000"}'::jsonb
           WHERE key = 'chain_pointer'"#,
    )
    .execute(&pool)
    .await
    .expect("reset chain_pointer");

    let u1 = U256::from(1u8);
    let u2 = U256::from(2u8);
    let alice = addr_byte(0xa1);

    let mut tx_id = 1u64;
    let mut li = 0u64;
    let mut next = |event: DecodedEvent| -> DecodedLog {
        tx_id += 1;
        li += 1;
        sample_log(100, tx_id, li, event)
    };

    let logs = vec![
        next(DecodedEvent::ArenaStarted {
            start_timestamp: u1,
            initial_deadline: u2,
        }),
        next(DecodedEvent::ArenaBuy {
            buyer: alice,
            charm_wad: u1,
            doub_paid: u1,
            new_deadline: u2,
            total_doub_raised_after: u1,
            buy_index: u1,
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            paid_with_cred: false,
        }),
        next(DecodedEvent::ArenaReferralCred {
            buyer: alice,
            referrer: addr_byte(0xee),
            code_hash: b256_lo(77_777),
            referrer_cred: u1,
            buyer_cred: u2,
        }),
        next(DecodedEvent::ArenaXpGained {
            player: alice,
            amount: u1,
            new_level: u2,
        }),
        next(DecodedEvent::ArenaCredClaimed {
            user: alice,
            epoch: u1,
            amount: u2,
        }),
        next(DecodedEvent::ArenaPodiumEpochRolled {
            category: 0,
            epoch: u1,
            first: alice,
            second: addr_byte(0xb2),
            third: addr_byte(0xb3),
            pool_paid: u2,
        }),
        next(DecodedEvent::ArenaWarbowSteal {
            attacker: alice,
            victim: addr_byte(0xb2),
            bp_taken: u1,
            doub_spent: u1,
            limit_bypass: false,
        }),
        next(DecodedEvent::ArenaWarbowGuard {
            player: alice,
            doub_spent: u1,
            guard_until: u2,
        }),
        next(DecodedEvent::ArenaWarbowEpochScore {
            epoch: u1,
            player: alice,
            battle_points: U256::from(900u32),
        }),
        next(DecodedEvent::ArenaReferralApplied {
            buyer: alice,
            referrer: addr_byte(0xee),
            code_hash: b256_lo(88_888),
            referrer_charm: u1,
            buyer_charm: u2,
            doub_paid: u1,
        }),
        next(DecodedEvent::ReferralCodeRegistered {
            owner: alice,
            code_hash: b256_lo(99_999),
            normalized_code: "ARENAQA".to_string(),
        }),
        next(DecodedEvent::ArenaPodiumPoolTopUp {
            donor: alice,
            amount_doub_wad: U256::from(700_000_000_000_000_000_000u128),
        }),
        next(DecodedEvent::ArenaVaultFunding {
            kind: VaultFundingKind::Admin,
            podium_id: None,
            amount_doub_wad: U256::from(DOUB_300),
            pool_address: None,
        }),
    ];

    let mut conn = pool.acquire().await.expect("acquire");
    for log in &logs {
        persist_decoded_log_conn(&mut conn, log)
            .await
            .expect("persist");
    }
    drop(conn);

    assert_eq!(count_where(&pool, "idx_arena_started", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_arena_buy", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_arena_referral_cred", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_player_xp", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_play_cred_claim", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_arena_podium_epoch", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_arena_warbow_steal", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_arena_warbow_guard", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_warbow_epoch_score", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_arena_referral_applied", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_referral_code_registered", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_arena_podium_pool_top_up", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_arena_vault_funding", 100).await,
        1
    );

    api_vault_funding_smoke(&pool).await;
    api_podium_pool_donations_smoke(&pool).await;

    persist_decoded_log_autocommit(&pool, &logs[1])
        .await
        .expect("idempotent replay");
    assert_eq!(count_where(&pool, "idx_arena_buy", 100).await, 1);

    let bh = b256_lo(100);
    upsert_indexed_block(&pool, 100, bh).await.expect("upsert block");
    save_chain_pointer(
        &pool,
        &ChainPointer {
            block_number: 100,
            block_hash: bh,
        },
    )
    .await
    .expect("save pointer");

    let ancestor = ChainPointer {
        block_number: 99,
        block_hash: b256_lo(99),
    };
    rollback_after(&pool, ancestor).await.expect("rollback");
    assert_eq!(count_where(&pool, "idx_arena_buy", 100).await, 0);
    assert_eq!(count_where(&pool, "idx_arena_vault_funding", 100).await, 0);

    let ptr = load_chain_pointer(&pool).await.expect("load pointer");
    assert_eq!(ptr.block_number, 99);

    api_http_smoke(&pool).await;
}

async fn api_podium_pool_donations_smoke(pool: &sqlx::PgPool) {
    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/arena/podium-pool-donations")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    assert_eq!(
        j.get("total_donated_doub_wad").and_then(|v| v.as_str()),
        Some("700000000000000000000")
    );
    assert_eq!(
        j.get("unique_donors_count").and_then(|v| v.as_str()),
        Some("1")
    );
    let recent = j.get("recent").and_then(|v| v.as_array()).expect("recent");
    assert_eq!(recent.len(), 1);

    let alice = format!("{:#x}", addr_byte(0xa1));
    let res = app
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/v1/arena/podium-pool-donations?donor={}",
                    alice
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    let summary = j.get("donor_summary").expect("donor_summary");
    assert_eq!(
        summary.get("donation_count").and_then(|v| v.as_str()),
        Some("1")
    );
}

async fn api_vault_funding_smoke(pool: &sqlx::PgPool) {
    let buy_tx_id = 9_000u64;
    let cred_tx_id = 9_001u64;
    let block = 200u64;
    let alice = addr_byte(0xa1);

    let buy_log = sample_log_tx(
        block,
        buy_tx_id,
        1,
        DecodedEvent::ArenaBuy {
            buyer: alice,
            charm_wad: U256::from(1u8),
            doub_paid: U256::from(DOUB_1000),
            new_deadline: U256::from(2u8),
            total_doub_raised_after: U256::from(DOUB_1000),
            buy_index: U256::from(1u8),
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            paid_with_cred: false,
        },
    );
    let funding_logs = vault_funding_rows_for_buy_tx(block, buy_tx_id, 1);
    let cred_buy_log = sample_log_tx(
        block + 1,
        cred_tx_id,
        1,
        DecodedEvent::ArenaBuy {
            buyer: alice,
            charm_wad: U256::from(1u8),
            doub_paid: U256::from(DOUB_1000),
            new_deadline: U256::from(2u8),
            total_doub_raised_after: U256::from(DOUB_1000),
            buy_index: U256::from(2u8),
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            paid_with_cred: true,
        },
    );

    persist_decoded_log_autocommit(pool, &buy_log)
        .await
        .expect("persist buy");
    for log in &funding_logs {
        persist_decoded_log_autocommit(pool, log)
            .await
            .expect("persist funding");
    }
    persist_decoded_log_autocommit(pool, &cred_buy_log)
        .await
        .expect("persist cred buy");

    assert_eq!(
        count_where(pool, "idx_arena_vault_funding", block as i64).await,
        9
    );

    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    let buy_tx_hash = format!("{:#x}", b256_lo(buy_tx_id));
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/v1/arena/vault-funding/by-tx/{}",
                    buy_tx_hash
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    let items = j.get("items").and_then(|v| v.as_array()).expect("items");
    assert_eq!(items.len(), 9);
    assert_eq!(
        j.get("total_funded_doub_wad").and_then(|v| v.as_str()),
        Some("1000000000000000000000")
    );

    let cred_tx_hash = format!("{:#x}", b256_lo(cred_tx_id));
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/v1/arena/vault-funding/by-tx/{}",
                    cred_tx_hash
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    assert_eq!(j.get("items").and_then(|v| v.as_array()).map(|a| a.len()), Some(0));

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/arena/vault-funding/totals")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    let by_kind = j.get("by_kind").and_then(|v| v.as_array()).expect("by_kind");
    assert_eq!(by_kind.len(), 3);
    let admin_total = by_kind
        .iter()
        .find(|r| r.get("kind").and_then(|v| v.as_str()) == Some("admin"))
        .and_then(|r| r.get("total_doub_wad").and_then(|v| v.as_str()));
    assert_eq!(admin_total, Some("600000000000000000000")); // fixture row + buy row

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/arena/vault-funding/recent?limit=5")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    assert!(j.get("items").and_then(|v| v.as_array()).is_some());

    let res = app
        .oneshot(
            Request::builder()
                .uri("/v1/arena/vault-funding/by-tx/0xbad")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    persist_decoded_log_autocommit(pool, &funding_logs[0])
        .await
        .expect("idempotent funding replay");
    assert_eq!(
        count_where(pool, "idx_arena_vault_funding", block as i64).await,
        9
    );
}

#[tokio::test]
async fn api_legacy_player_reserve_routes_return_404() {
    let Some(url) = pg_url() else {
        eprintln!("skip api_legacy_player_reserve_routes_return_404: set YIELDOMEGA_PG_TEST_URL");
        return;
    };

    let pool = connect_and_migrate(&url, DEFAULT_DATABASE_POOL_MAX)
        .await
        .expect("connect_and_migrate");

    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    for path in ["/v1/rabbit/deposits", "/v1/rabbit/health-epochs"] {
        let res = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri(path)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND, "expected 404 for {path}");
    }
}

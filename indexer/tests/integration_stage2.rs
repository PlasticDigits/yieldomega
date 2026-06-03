// SPDX-License-Identifier: AGPL-3.0-or-later

//! Postgres integration: Arena v2 migrations, persist all `DecodedEvent` variants,
//! idempotency, `rollback_after`, and HTTP API smoke (`/v1/arena/*`, `/v1/referrals/*`).

use alloy_primitives::{address, Address, B256, U256};
use std::sync::LazyLock;
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
use yieldomega_indexer::last_buy_epoch_head::LastBuyEpochHead;
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

async fn clear_arena_index_for_test(pool: &sqlx::PgPool) {
    for table in yieldomega_indexer::reorg::ARENA_INDEX_TABLES {
        let q = format!("DELETE FROM {table}");
        sqlx::query(&q).execute(pool).await.expect("clear index table");
    }
    sqlx::query("DELETE FROM indexed_blocks")
        .execute(pool)
        .await
        .expect("clear indexed_blocks");
}

static PG_INTEGRATION_MUTEX: LazyLock<tokio::sync::Mutex<()>> =
    LazyLock::new(|| tokio::sync::Mutex::new(()));

async fn pg_integration_lock() -> tokio::sync::MutexGuard<'static, ()> {
    PG_INTEGRATION_MUTEX.lock().await
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
            last_buy_epoch: "1".into(),
            podium_epochs: ["1", "0", "0", "2"].map(String::from),
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

    let _pg = pg_integration_lock().await;

    let pool = connect_and_migrate(&url, DEFAULT_DATABASE_POOL_MAX)
        .await
        .expect("connect_and_migrate");

    clear_arena_index_for_test(&pool).await;
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
        next(DecodedEvent::ArenaLastBuyEpochStarted {
            epoch: u1,
            deadline: u2,
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
    let mut head = LastBuyEpochHead::INITIAL;
    for log in &logs {
        persist_decoded_log_conn(&mut conn, &mut head, log)
            .await
            .expect("persist");
    }
    drop(conn);

    assert_eq!(count_where(&pool, "idx_arena_started", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_arena_last_buy_epoch_started", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_arena_buy", 100).await, 1);
    let buy_epoch: i64 = sqlx::query_scalar(
        "SELECT last_buy_epoch FROM idx_arena_buy WHERE block_number = 100 LIMIT 1",
    )
    .fetch_one(&pool)
    .await
    .expect("buy epoch");
    assert_eq!(buy_epoch, 1);
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
    api_arena_buys_actual_seconds_added_smoke(&pool).await;

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
    assert_eq!(
        count_where(&pool, "idx_arena_last_buy_epoch_started", 100).await,
        0
    );
    assert_eq!(count_where(&pool, "idx_arena_vault_funding", 100).await, 0);

    let ptr = load_chain_pointer(&pool).await.expect("load pointer");
    assert_eq!(ptr.block_number, 99);

    api_http_smoke(&pool).await;
    arena_podiums_live_predictions_smoke(&pool).await;
}

/// Live `GET /v1/arena/podiums` from `idx_arena_podium_live` + WarBow scores ([#273](https://gitlab.com/PlasticDigits/yieldomega/-/issues/273)).
async fn arena_podiums_live_predictions_smoke(pool: &sqlx::PgPool) {
    let alice = format!("{:#x}", addr_byte(0xa1));
    let bob = format!("{:#x}", addr_byte(0xb2));
    let wb_player = format!("{:#x}", addr_byte(0xc3));

    sqlx::query(
        r#"INSERT INTO idx_arena_podium_live (
            category, epoch, slot, player, score, block_number, tx_hash, log_index
        ) VALUES
            (0, 1, 0, $1, 3, 50, '0x01', 1),
            (0, 1, 1, $2, 2, 50, '0x01', 2),
            (0, 1, 2, $3, 1, 50, '0x01', 3)"#,
    )
    .bind(&alice)
    .bind(&bob)
    .bind(format!("{:#x}", addr_byte(0xb3)))
    .execute(pool)
    .await
    .expect("seed last buy live");

    sqlx::query(
        r#"INSERT INTO idx_warbow_epoch_score (
            block_number, tx_hash, log_index, epoch, player, battle_points
        ) VALUES (60, '0x02', 1, 2, $1, 500)"#,
    )
    .bind(&wb_player)
    .execute(pool)
    .await
    .expect("seed warbow score");

    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    let res = app
        .oneshot(
            Request::builder()
                .uri("/v1/arena/podiums")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    let rows = j.get("rows").and_then(|v| v.as_array()).expect("rows");
    assert_eq!(rows.len(), 4);

    assert_eq!(rows[0].get("category").and_then(|v| v.as_str()), Some("last_buy"));
    assert_eq!(rows[0].get("epoch").and_then(|v| v.as_str()), Some("1"));
    assert_eq!(
        rows[0].get("podium_prediction").and_then(|v| v.as_bool()),
        Some(true)
    );
    assert_eq!(
        rows[0].get("winners").and_then(|v| v.as_array()).unwrap()[0]
            .as_str()
            .unwrap()
            .to_ascii_lowercase(),
        alice.to_ascii_lowercase()
    );

    assert_eq!(rows[1].get("category").and_then(|v| v.as_str()), Some("warbow"));
    assert_eq!(rows[1].get("category_index").and_then(|v| v.as_u64()), Some(3));
    assert_eq!(rows[1].get("epoch").and_then(|v| v.as_str()), Some("2"));
    assert_eq!(
        rows[1].get("podium_prediction").and_then(|v| v.as_bool()),
        Some(true)
    );
    assert_eq!(
        rows[1].get("winners").and_then(|v| v.as_array()).unwrap()[0]
            .as_str()
            .unwrap()
            .to_ascii_lowercase(),
        wb_player.to_ascii_lowercase()
    );

    assert_eq!(
        rows[2].get("category").and_then(|v| v.as_str()),
        Some("defended_streak")
    );
    assert_eq!(
        rows[3].get("category").and_then(|v| v.as_str()),
        Some("time_booster")
    );
}

/// `GET /v1/arena/buys` exposes buy-row fields from `idx_arena_buy` ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282), [#283](https://gitlab.com/PlasticDigits/yieldomega/-/issues/283)).
async fn api_arena_buys_actual_seconds_added_smoke(pool: &sqlx::PgPool) {
    let block = 301u64;
    let tx_id = 30_282u64;
    let alice = addr_byte(0xa1);
    let seconds = 120u64;

    let buy_log = sample_log_tx(
        block,
        tx_id,
        1,
        DecodedEvent::ArenaBuy {
            buyer: alice,
            charm_wad: U256::from(1_000_000_000_000_000_000u128),
            doub_paid: U256::from(DOUB_100),
            new_deadline: U256::from(1_700_000_120u64),
            total_doub_raised_after: U256::from(DOUB_100),
            buy_index: U256::from(1u8),
            actual_seconds_added: U256::from(seconds),
            timer_hard_reset: false,
            paid_with_cred: false,
        },
    );
    persist_decoded_log_autocommit(pool, &buy_log)
        .await
        .expect("persist buy for arena_buys smoke");

    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    let res = app
        .oneshot(
            Request::builder()
                .uri("/v1/arena/buys?limit=5")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    let items = j.get("items").and_then(|v| v.as_array()).expect("items");
    let row = items
        .iter()
        .find(|r| {
            r.get("tx_hash")
                .and_then(|v| v.as_str())
                .map(|h| h.eq_ignore_ascii_case(&format!("{:#x}", buy_log.tx_hash)))
                .unwrap_or(false)
        })
        .expect("buy row in /v1/arena/buys");
    assert_eq!(
        row.get("actual_seconds_added").and_then(|v| v.as_str()),
        Some(seconds.to_string().as_str())
    );
    assert_eq!(
        row.get("new_deadline").and_then(|v| v.as_str()),
        Some("1700000120")
    );
    assert_eq!(row.get("buy_index").and_then(|v| v.as_str()), Some("1"));
    assert_eq!(
        row.get("log_index").and_then(|v| v.as_i64()),
        Some(buy_log.log_index as i64)
    );

    let db_row: (String, String, i32, Option<String>) = sqlx::query_as(
        r#"SELECT actual_seconds_added::text, new_deadline::text, log_index,
                  EXTRACT(EPOCH FROM block_timestamp)::text
           FROM idx_arena_buy
           WHERE tx_hash = $1 AND log_index = $2"#,
    )
    .bind(format!("{:#x}", buy_log.tx_hash))
    .bind(buy_log.log_index as i64)
    .fetch_one(pool)
    .await
    .expect("db buy row");
    assert_eq!(db_row.0, seconds.to_string());
    assert_eq!(db_row.1, "1700000120");
    assert_eq!(db_row.2, buy_log.log_index as i32);
    assert_eq!(
        row.get("block_timestamp").and_then(|v| v.as_str()),
        db_row.3.as_deref()
    );
    assert!(
        db_row
            .3
            .as_ref()
            .is_some_and(|s| s.starts_with("1700000000")),
        "unexpected block_timestamp: {:?}",
        db_row.3
    );
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
async fn arena_wallet_stats_two_epochs_and_bonus_fields() {
    let Some(url) = pg_url() else {
        eprintln!("skip arena_wallet_stats_two_epochs: set YIELDOMEGA_PG_TEST_URL");
        return;
    };

    let _pg = pg_integration_lock().await;

    let pool = connect_and_migrate(&url, DEFAULT_DATABASE_POOL_MAX)
        .await
        .expect("connect_and_migrate");

    clear_arena_index_for_test(&pool).await;

    let alice = addr_byte(0xa1);
    let alice_hex = format!("{alice:#x}");
    let block = 500u64;
    let ts = 1_700_100_000u64;

    let mk_buy =
        |tx_id: u64, log_index: u64, hard_reset: bool, doub: u128| -> DecodedLog {
            let mut log = sample_log_tx(
                block + tx_id,
                tx_id,
                log_index,
                DecodedEvent::ArenaBuy {
                    buyer: alice,
                    charm_wad: U256::from(1_000_000_000_000_000_000u128),
                    doub_paid: U256::from(doub),
                    new_deadline: U256::from(ts + 900),
                    total_doub_raised_after: U256::from(doub),
                    buy_index: U256::from(tx_id),
                    actual_seconds_added: U256::from(120u64),
                    timer_hard_reset: hard_reset,
                    paid_with_cred: false,
                },
            );
            log.block_timestamp = Some(ts + tx_id);
            log
        };

    let mut reset_tx = sample_log_tx(
        block + 2,
        2,
        1,
        DecodedEvent::ArenaLastBuyEpochStarted {
            epoch: U256::from(1u8),
            deadline: U256::from(ts + 900),
        },
    );
    reset_tx.block_timestamp = Some(ts + 2);
    let mut reset_buy = mk_buy(2, 2, true, DOUB_1000);
    reset_buy.tx_hash = reset_tx.tx_hash;
    reset_buy.block_number = reset_tx.block_number;

    let logs = vec![
        mk_buy(1, 1, false, DOUB_100),
        reset_tx,
        reset_buy,
        sample_log_tx(
            block + 3,
            3,
            1,
            DecodedEvent::ArenaXpGained {
                player: alice,
                amount: U256::from(5u8),
                new_level: U256::from(2u8),
            },
        ),
        sample_log_tx(
            block + 4,
            4,
            1,
            DecodedEvent::ArenaReferralCred {
                buyer: alice,
                referrer: addr_byte(0xee),
                code_hash: b256_lo(1),
                referrer_cred: U256::from(5_000_000_000_000_000_000u128),
                buyer_cred: U256::from(5_000_000_000_000_000_000u128),
            },
        ),
        sample_log_tx(
            block + 5,
            5,
            1,
            DecodedEvent::ArenaPodiumEpochRolled {
                category: 0,
                epoch: U256::from(1u8),
                first: alice,
                second: addr_byte(0xb2),
                third: addr_byte(0xb3),
                pool_paid: U256::from(700u128),
            },
        ),
        sample_log_tx(
            block + 6,
            6,
            1,
            DecodedEvent::ArenaWarbowGuard {
                player: alice,
                doub_spent: U256::from(1u8),
                guard_until: U256::from(ts + 3600),
            },
        ),
    ];

    for log in &logs {
        persist_decoded_log_autocommit(&pool, log)
            .await
            .expect("persist wallet stats fixture");
    }

    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    let res = app
        .oneshot(
            Request::builder()
                .uri(format!("/v1/arena/wallet/{alice_hex}/stats"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;

    assert_eq!(j.get("epochs_participated").and_then(|v| v.as_i64()), Some(2));
    assert_eq!(j.get("buy_count").and_then(|v| v.as_i64()), Some(2));
    assert_eq!(j.get("xp").and_then(|v| v.as_str()), Some("5"));
    assert_eq!(j.get("level").and_then(|v| v.as_str()), Some("2"));
    assert_eq!(j.get("warbow_guards").and_then(|v| v.as_i64()), Some(1));
    assert_eq!(
        j.get("referral_cred_earned").and_then(|v| v.as_str()),
        Some("5000000000000000000")
    );

    let prizes = j.get("prizes_won").and_then(|v| v.as_array()).expect("prizes_won");
    assert_eq!(prizes.len(), 1);
    assert_eq!(prizes[0].get("podium").and_then(|v| v.as_str()), Some("last_buy"));
    assert_eq!(prizes[0].get("rank").and_then(|v| v.as_u64()), Some(1));
    assert_eq!(prizes[0].get("amount_doub").and_then(|v| v.as_str()), Some("400"));

    let total_won = j.get("total_won_doub").and_then(|v| v.as_str()).expect("total_won");
    assert_eq!(total_won, "400");

    let highest = j
        .get("highest_scores")
        .and_then(|v| v.as_array())
        .expect("highest_scores");
    assert_eq!(highest.len(), 4);

    let rank_dist = j.get("rank_distribution").expect("rank_distribution");
    assert_eq!(rank_dist.get("1").and_then(|v| v.as_str()), Some("1"));
}


/// Global Last Buy epoch on buys — wallet B in epoch 1 without hard-resetting ([#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278)).
#[tokio::test]
async fn last_buy_epoch_global_assignment_non_resetting_participant() {
    let Some(url) = pg_url() else {
        eprintln!("skip last_buy_epoch_global_assignment: set YIELDOMEGA_PG_TEST_URL");
        return;
    };

    let _pg = pg_integration_lock().await;

    let pool = connect_and_migrate(&url, DEFAULT_DATABASE_POOL_MAX)
        .await
        .expect("connect_and_migrate");

    clear_arena_index_for_test(&pool).await;

    let alice = addr_byte(0xa1);
    let bob = addr_byte(0xb2);
    let bob_hex = format!("{bob:#x}");
    let block = 600u64;
    let ts = 1_700_200_000u64;

    let mk_buy = |tx_id: u64, log_index: u64, buyer: Address, hard_reset: bool| -> DecodedLog {
        let mut log = sample_log_tx(
            block + tx_id,
            tx_id,
            log_index,
            DecodedEvent::ArenaBuy {
                buyer,
                charm_wad: U256::from(1_000_000_000_000_000_000u128),
                doub_paid: U256::from(DOUB_100),
                new_deadline: U256::from(ts + 900),
                total_doub_raised_after: U256::from(DOUB_100),
                buy_index: U256::from(tx_id),
                actual_seconds_added: U256::from(120u64),
                timer_hard_reset: hard_reset,
                paid_with_cred: false,
            },
        );
        log.block_timestamp = Some(ts + tx_id);
        log
    };

    let mut epoch_start = sample_log_tx(
        block + 2,
        2,
        1,
        DecodedEvent::ArenaLastBuyEpochStarted {
            epoch: U256::from(1u8),
            deadline: U256::from(ts + 900),
        },
    );
    epoch_start.block_timestamp = Some(ts + 2);
    let mut alice_reset_buy = mk_buy(2, 2, alice, true);
    alice_reset_buy.tx_hash = epoch_start.tx_hash;
    alice_reset_buy.block_number = epoch_start.block_number;

    let logs = vec![
        mk_buy(1, 1, alice, false),
        epoch_start,
        alice_reset_buy,
        mk_buy(3, 1, bob, false),
    ];

    for log in &logs {
        persist_decoded_log_autocommit(&pool, log)
            .await
            .expect("persist global epoch fixture");
    }

    let bob_epoch: i64 = sqlx::query_scalar(
        "SELECT last_buy_epoch FROM idx_arena_buy WHERE buyer = $1",
    )
    .bind(&bob_hex)
    .fetch_one(&pool)
    .await
    .expect("bob buy epoch");
    assert_eq!(bob_epoch, 1);

    let chain_timer = Arc::new(RwLock::new(Some(arena_head_snapshot())));
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer,
        ingestion_alive: Arc::new(AtomicBool::new(true)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(1)),
    });

    let res = app
        .oneshot(
            Request::builder()
                .uri(format!("/v1/arena/wallet/{bob_hex}/stats"))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    assert_eq!(j.get("epochs_participated").and_then(|v| v.as_i64()), Some(1));
    assert_eq!(j.get("buy_count").and_then(|v| v.as_i64()), Some(1));
}

#[tokio::test]
async fn api_legacy_player_reserve_routes_return_404() {
    let Some(url) = pg_url() else {
        eprintln!("skip api_legacy_player_reserve_routes_return_404: set YIELDOMEGA_PG_TEST_URL");
        return;
    };

    let _pg = pg_integration_lock().await;

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

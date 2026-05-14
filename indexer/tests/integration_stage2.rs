// SPDX-License-Identifier: AGPL-3.0-or-later

//! Postgres integration: migrations, every non-`Unknown` [`DecodedEvent`] variant persisted
//! (GitLab [#112](https://gitlab.com/PlasticDigits/yieldomega/-/issues/112) treasury / vesting / operator emits included;
//! GitLab [#139](https://gitlab.com/PlasticDigits/yieldomega/-/issues/139) `PodiumResidualRecipientSet` + buy-router `EthRescued`/`Erc20Rescued`),
//! idempotency replay, `rollback_after` truncating rows above the ancestor block (including
//! referral / prize tables), **per-block SQL transaction semantics for ingest** ([GitLab #140](https://gitlab.com/PlasticDigits/yieldomega/-/issues/140); umbrella [#146](https://gitlab.com/PlasticDigits/yieldomega/-/issues/146)),
//! then HTTP API smoke.
//!
//! **When `YIELDOMEGA_PG_TEST_URL` is unset or empty:** the test returns immediately and still
//! **reports `ok`** — it does not connect to Postgres. For real coverage, set the URL (see
//! [`docs/testing/invariants-and-business-logic.md`](../../docs/testing/invariants-and-business-logic.md)
//! and [`.github/workflows/unit-tests.yml`](../../.github/workflows/unit-tests.yml)).
//!
//! Uses one `#[tokio::test]` so parallel test threads do not race on the same database.
//! The same test finishes with HTTP API checks on the shared pool.

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
use yieldomega_indexer::db::connect_and_migrate;
use yieldomega_indexer::decoder::{DecodedEvent, DecodedLog};
use yieldomega_indexer::persist::{persist_decoded_log_autocommit, persist_decoded_log_conn};
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

async fn api_http_smoke(pool: &sqlx::PgPool) {
    let app = router(AppState {
        pool: pool.clone(),
        chain_timer: Arc::new(RwLock::new(None)),
        ingestion_alive: Arc::new(AtomicBool::new(false)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(0)),
    });

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
                .uri("/v1/timecurve/chain-timer")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::SERVICE_UNAVAILABLE);

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
    assert_eq!(status_json["ingestion_alive"], false);
    assert_eq!(status_json["last_indexed_at_ms"], 0);

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
        "/v1/referrals/referrer-leaderboard?limit=2",
        "/v1/leprechauns/mints?limit=2",
        "/v1/fee-router/sinks-updates?limit=2",
        "/v1/fee-router/fees-distributed?limit=2",
        "/v1/rabbit/faction-stats",
        "/v1/timecurve/warbow/battle-feed?limit=2",
        "/v1/timecurve/warbow/leaderboard?limit=2",
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

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/timecurve/warbow/refresh-candidates?limit=50&offset=0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    assert!(j["candidates"].is_array());
    assert!(j.get("total").is_some());
    assert_eq!(j["sale_ended"], false);

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/referrals/wallet-charm-summary?wallet=0xbad")
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
                .uri("/v1/referrals/wallet-charm-summary?wallet=0xdddddddddddddddddddddddddddddddddddddddd")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let wsum = response_json(res).await;
    assert_eq!(wsum["wallet"], "0xdddddddddddddddddddddddddddddddddddddddd");
    assert!(wsum["referrer_charm_wad"].is_string());
    assert!(wsum["referee_charm_wad"].is_string());

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/timecurve/warbow/steals-by-victim-day?victim=0xbad")
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
                .uri("/v1/timecurve/warbow/steals-by-victim-day?victim=0xdddddddddddddddddddddddddddddddddddddddd")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    assert!(j["items"].is_array());

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/timecurve/warbow/guard-latest?player=0xbad")
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
                .uri("/v1/timecurve/warbow/guard-latest?player=0xdddddddddddddddddddddddddddddddddddddddd")
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
                .uri("/v1/timecurve/warbow/pending-revenge?victim=0xbad&now_sec=1")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);

    let vb2 = format!("{:#x}", addr_byte(0xb2));
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/v1/timecurve/warbow/pending-revenge?victim={vb2}&now_sec=1"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let pr = response_json(res).await;
    assert!(pr["items"].is_array());

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
    assert!(
        j["total"].as_i64().unwrap_or(0) >= 1,
        "expected non-empty buys total: {j:?}"
    );

    let res = app
        .clone()
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

    // Same-tx `Buy` + `BuyViaKumbaya` correlation on `/v1/timecurve/buys` (GitLab #67).
    let k_buyer = addr_byte(0x33);
    let u1 = U256::from(1u8);
    let u2 = U256::from(2u8);
    let charm = U256::from(7u8);
    let shared_tx = b256_lo(12_345);
    let buy_join = DecodedLog {
        block_number: 44,
        block_hash: b256_lo(44 + 10_000),
        tx_hash: shared_tx,
        log_index: 0,
        block_timestamp: None,
        contract: address!("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        event: DecodedEvent::TimeCurveBuy {
            buyer: k_buyer,
            charm_wad: charm,
            amount: charm,
            price_per_charm_wad: u1,
            new_deadline: u2,
            total_raised_after: u1,
            buy_index: u1,
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            battle_points_after: U256::ZERO,
            bp_base_buy: U256::ZERO,
            bp_timer_reset_bonus: U256::ZERO,
            bp_clutch_bonus: U256::ZERO,
            bp_streak_break_bonus: U256::ZERO,
            bp_ambush_bonus: U256::ZERO,
            bp_flag_penalty: U256::ZERO,
            flag_planted: false,
            buyer_total_effective_timer_sec: U256::ZERO,
            buyer_active_defended_streak: U256::ZERO,
            buyer_best_defended_streak: U256::ZERO,
        },
    };
    let k_log = DecodedLog {
        block_number: 44,
        block_hash: buy_join.block_hash,
        tx_hash: shared_tx,
        log_index: 1,
        block_timestamp: None,
        contract: address!("0x2222222222222222222222222222222222222222"),
        event: DecodedEvent::TimeCurveBuyRouterBuyViaKumbaya {
            buyer: k_buyer,
            charm_wad: charm,
            gross_cl8y: charm,
            pay_kind: 0,
        },
    };
    persist_decoded_log_autocommit(pool, &buy_join)
        .await
        .expect("persist join buy");
    persist_decoded_log_autocommit(pool, &k_log)
        .await
        .expect("persist buy via kumbaya");
    let res = app
        .oneshot(
            Request::builder()
                .uri("/v1/timecurve/buys?limit=50")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let j = response_json(res).await;
    let row = j["items"]
        .as_array()
        .expect("items")
        .iter()
        .find(|r| r["tx_hash"] == format!("{:#x}", shared_tx))
        .expect("joined buy row");
    assert_eq!(row["entry_pay_asset"], "eth");
    assert_eq!(row["router_attested_gross_cl8y"], "7");
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
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            battle_points_after: U256::ZERO,
            bp_base_buy: U256::ZERO,
            bp_timer_reset_bonus: U256::ZERO,
            bp_clutch_bonus: U256::ZERO,
            bp_streak_break_bonus: U256::ZERO,
            bp_ambush_bonus: U256::ZERO,
            bp_flag_penalty: U256::ZERO,
            flag_planted: false,
            buyer_total_effective_timer_sec: U256::ZERO,
            buyer_active_defended_streak: U256::ZERO,
            buyer_best_defended_streak: U256::ZERO,
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
        next(DecodedEvent::TimeCurvePrizesSettledEmptyPodiumPool {
            podium_pool: addr_byte(0x77),
        }),
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
            old_weights: [3000, 4000, 2000, 0, 1000],
            new_destinations: [addr_byte(2); 5],
            new_weights: [2000, 2000, 2000, 2000, 2000],
        }),
        next(DecodedEvent::FeeRouterFeesDistributed {
            token: reserve,
            amount: u2,
            shares: [u1, u1, u1, u1, u2],
        }),
        next(DecodedEvent::FeeRouterDistributableTokenUpdated {
            token: reserve,
            allowed: true,
            actor: alice,
        }),
        next(DecodedEvent::FeeRouterERC20Rescued {
            token: reserve,
            recipient: alice,
            amount: u1,
            actor: alice,
        }),
        next(DecodedEvent::TimeCurveWarBowSteal {
            attacker: alice,
            victim: addr_byte(0xb2),
            amount_bp: u1,
            burn_paid_wad: u1,
            bypassed_victim_daily_limit: false,
            victim_bp_after: u2,
            attacker_bp_after: u1,
        }),
        next(DecodedEvent::TimeCurveWarBowRevengeWindowOpened {
            victim: addr_byte(0xb2),
            stealer: alice,
            expiry_exclusive: u2,
            steal_seq: u1,
        }),
        next(DecodedEvent::TimeCurveWarBowRevenge {
            avenger: alice,
            stealer: addr_byte(0xb2),
            amount_bp: u1,
            burn_paid_wad: u1,
        }),
        next(DecodedEvent::TimeCurveWarBowGuardActivated {
            player: alice,
            guard_until_ts: u2,
            burn_paid_wad: u1,
        }),
        next(DecodedEvent::TimeCurveWarBowFlagClaimed {
            player: alice,
            bonus_bp: u2,
            battle_points_after: u1,
        }),
        next(DecodedEvent::TimeCurveWarBowFlagPenalized {
            former_holder: alice,
            penalty_bp: u1,
            triggering_buyer: addr_byte(0xb2),
            battle_points_after: u2,
        }),
        next(DecodedEvent::TimeCurveWarBowCl8yBurned {
            payer: alice,
            reason: 0,
            amount_wad: u1,
        }),
        next(DecodedEvent::TimeCurveWarBowDefendedStreakContinued {
            wallet: alice,
            active_streak: u2,
            best_streak: u2,
        }),
        next(DecodedEvent::TimeCurveWarBowDefendedStreakBroken {
            former_holder: alice,
            interrupter: addr_byte(0xb3),
            broken_active_length: u2,
        }),
        next(DecodedEvent::TimeCurveWarBowDefendedStreakWindowCleared {
            cleared_wallet: alice,
        }),
        next(DecodedEvent::TimeCurveBuyFeeRoutingEnabled { enabled: true }),
        next(DecodedEvent::TimeCurveCharmRedemptionEnabled { enabled: false }),
        next(DecodedEvent::TimeCurveReservePodiumPayoutsEnabled { enabled: true }),
        next(DecodedEvent::TimeCurveBuyRouterSet {
            router: addr_byte(0x44),
        }),
        next(DecodedEvent::TimeCurveDoubPresaleVestingSet {
            vesting: addr_byte(0x45),
        }),
        next(DecodedEvent::TimeCurveUnredeemedLaunchedTokenRecipientSet {
            recipient: addr_byte(0x46),
        }),
        next(DecodedEvent::TimeCurveUnredeemedLaunchedTokenSwept {
            recipient: addr_byte(0x46),
            amount: u2,
        }),
        next(DecodedEvent::TimeCurvePodiumResidualRecipientSet {
            recipient: addr_byte(0x47),
        }),
        next(DecodedEvent::TimeCurveBuyRouterCl8ySurplus { amount: u2 }),
        next(DecodedEvent::TimeCurveBuyRouterEthRescued {
            to: addr_byte(0x48),
            amount: u1,
        }),
        next(DecodedEvent::TimeCurveBuyRouterErc20Rescued {
            token: reserve,
            to: addr_byte(0x49),
            amount: u2,
        }),
        next(DecodedEvent::PodiumPoolPrizePusherSet {
            pusher: addr_byte(0x55),
        }),
        next(DecodedEvent::RabbitBurrowReserveBuckets {
            epoch_id: u1,
            redeemable_backing: u1,
            protocol_owned_backing: u2,
            total_backing: u2,
        }),
        next(DecodedEvent::RabbitProtocolRevenueSplit {
            epoch_id: u1,
            gross_amount: u2,
            to_protocol_bucket: u1,
            burned_amount: U256::ZERO,
        }),
        next(DecodedEvent::RabbitWithdrawalFeeAccrued {
            asset: reserve,
            fee_amount: u1,
            cumulative_withdraw_fees: u2,
        }),
        next(DecodedEvent::DoubVestingStarted {
            start_timestamp: u1,
            duration_sec: U256::from(86_400u64),
            total_allocated: U256::from(1_000_000u128 * 10u128.pow(18)),
        }),
        next(DecodedEvent::DoubVestingClaimed {
            beneficiary: alice,
            amount: u2,
        }),
        next(DecodedEvent::DoubVestingClaimsEnabled { enabled: true }),
        next(DecodedEvent::DoubVestingRescueErc20 {
            token: addr_byte(0x33),
            recipient: addr_byte(0x44),
            amount: u1,
            kind: 0,
        }),
        next(DecodedEvent::FeeSinkWithdrawn {
            token: reserve,
            recipient: alice,
            amount: u2,
            actor: addr_byte(0xfa),
        }),
        next(DecodedEvent::TimeCurveBuyRouterBuyViaKumbaya {
            buyer: alice,
            charm_wad: u1,
            gross_cl8y: u2,
            pay_kind: 1,
        }),
    ];

    for d in &logs {
        persist_decoded_log_autocommit(&pool, d)
            .await
            .unwrap_or_else(|e| panic!("persist {:?}: {e}", d.event));
    }

    assert_eq!(
        count_where(&pool, "idx_timecurve_sale_started", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_kumbaya", 100).await,
        1
    );
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
        count_where(&pool, "idx_timecurve_prizes_settled_empty_podium_pool", 100).await,
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
    assert_eq!(count_where(&pool, "idx_podium_pool_paid", 100).await, 1);
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
    assert_eq!(
        count_where(&pool, "idx_fee_router_distributable_token_updated", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_fee_router_erc20_rescued", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_steal", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_revenge_window", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_revenge", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_guard", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_flag_claimed", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_flag_penalized", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_cl8y_burned", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_ds_continued", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_ds_broken", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_ds_window_cleared", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_fee_routing_enabled", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_charm_redemption_enabled", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_reserve_podium_payouts_enabled", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_set", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_presale_vesting_set", 100).await,
        1
    );
    assert_eq!(
        count_where(
            &pool,
            "idx_timecurve_unredeemed_launched_token_recipient_set",
            100
        )
        .await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_unredeemed_launched_token_swept", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_podium_residual_recipient_set", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_cl8y_surplus", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_eth_rescued", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_erc20_rescued", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_podium_pool_prize_pusher_set", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_rabbit_burrow_reserve_buckets", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_rabbit_protocol_revenue_split", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_rabbit_withdrawal_fee_accrued", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_doub_vesting_started", 100).await, 1);
    assert_eq!(count_where(&pool, "idx_doub_vesting_claimed", 100).await, 1);
    assert_eq!(
        count_where(&pool, "idx_doub_vesting_claims_enabled", 100).await,
        1
    );
    assert_eq!(
        count_where(&pool, "idx_doub_vesting_rescue_erc20", 100).await,
        1
    );
    assert_eq!(count_where(&pool, "idx_fee_sink_withdrawn", 100).await, 1);

    // Idempotency: same (tx_hash, log_index) again
    let first = &logs[1];
    persist_decoded_log_autocommit(&pool, first).await.expect("replay");
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 100).await, 1);
    let k_last = logs.last().expect("kumbaya log");
    persist_decoded_log_autocommit(&pool, k_last)
        .await
        .expect("replay kumbaya");
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_kumbaya", 100).await,
        1
    );

    // Unknown: no-op, no panic
    let unknown = DecodedLog {
        block_number: 100,
        block_hash: first.block_hash,
        tx_hash: b256_lo(999_001),
        log_index: 999,
        block_timestamp: None,
        contract: CONTRACT,
        event: DecodedEvent::Unknown { topic0: B256::ZERO },
    };
    persist_decoded_log_autocommit(&pool, &unknown).await.expect("unknown");

    let app = router(AppState {
        pool: pool.clone(),
        chain_timer: Arc::new(RwLock::new(None)),
        ingestion_alive: Arc::new(AtomicBool::new(false)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(0)),
    });
    let vb2 = format!("{:#x}", addr_byte(0xb2));
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri(format!(
                    "/v1/timecurve/warbow/pending-revenge?victim={vb2}&now_sec=1"
                ))
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let pr = response_json(res).await;
    let items = pr["items"].as_array().expect("items");
    assert_eq!(items.len(), 1);
    assert_eq!(items[0]["stealer"], format!("{:#x}", alice));

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
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            battle_points_after: U256::ZERO,
            bp_base_buy: U256::ZERO,
            bp_timer_reset_bonus: U256::ZERO,
            bp_clutch_bonus: U256::ZERO,
            bp_streak_break_bonus: U256::ZERO,
            bp_ambush_bonus: U256::ZERO,
            bp_flag_penalty: U256::ZERO,
            flag_planted: false,
            buyer_total_effective_timer_sec: U256::ZERO,
            buyer_active_defended_streak: U256::ZERO,
            buyer_best_defended_streak: U256::ZERO,
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
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            battle_points_after: U256::ZERO,
            bp_base_buy: U256::ZERO,
            bp_timer_reset_bonus: U256::ZERO,
            bp_clutch_bonus: U256::ZERO,
            bp_streak_break_bonus: U256::ZERO,
            bp_ambush_bonus: U256::ZERO,
            bp_flag_penalty: U256::ZERO,
            flag_planted: false,
            buyer_total_effective_timer_sec: U256::ZERO,
            buyer_active_defended_streak: U256::ZERO,
            buyer_best_defended_streak: U256::ZERO,
        },
    );
    persist_decoded_log_autocommit(&pool, &d5).await.expect("d5");
    persist_decoded_log_autocommit(&pool, &d20).await.expect("d20");

    assert_eq!(count_where(&pool, "idx_timecurve_buy", 5).await, 1);
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 20).await, 1);

    rollback_after(&pool, anc).await.expect("rollback");

    assert_eq!(count_where(&pool, "idx_timecurve_buy", 5).await, 1);
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 20).await, 0);
    // Block 100 batch must be removed (rollback deletes `block_number > ancestor`).
    assert_eq!(count_where(&pool, "idx_timecurve_buy", 100).await, 0);
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_steal", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_revenge_window", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_revenge", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_guard", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_flag_claimed", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_flag_penalized", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_cl8y_burned", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_ds_continued", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_ds_broken", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_warbow_ds_window_cleared", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_kumbaya", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_podium_residual_recipient_set", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_eth_rescued", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_router_erc20_rescued", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_buy_fee_routing_enabled", 100).await,
        0
    );
    assert_eq!(count_where(&pool, "idx_doub_vesting_claimed", 100).await, 0);
    assert_eq!(
        count_where(&pool, "idx_doub_vesting_rescue_erc20", 100).await,
        0
    );
    assert_eq!(count_where(&pool, "idx_fee_sink_withdrawn", 100).await, 0);
    assert_eq!(
        count_where(&pool, "idx_timecurve_reserve_podium_payouts_enabled", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_timecurve_referral_applied", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_referral_code_registered", 100).await,
        0
    );
    assert_eq!(count_where(&pool, "idx_podium_pool_paid", 100).await, 0);
    assert_eq!(count_where(&pool, "idx_rabbit_deposit", 100).await, 0);
    assert_eq!(
        count_where(&pool, "idx_fee_router_distributable_token_updated", 100).await,
        0
    );
    assert_eq!(
        count_where(&pool, "idx_fee_router_erc20_rescued", 100).await,
        0
    );

    let row = sqlx::query("SELECT block_number FROM indexed_blocks WHERE block_number = 20")
        .fetch_optional(&pool)
        .await
        .expect("query ib");
    assert!(row.is_none());

    let p = load_chain_pointer(&pool).await.expect("load ptr");
    assert_eq!(p.block_number, 5);
    assert_eq!(p.block_hash, h5);

    // ── C) Per-block transaction rollback leaves no ghost rows (#140) ───
    let ptr_before_d = p;
    const GHOST_BLOCK: u64 = 9_990_001;
    let ghost_sale = DecodedLog {
        block_number: GHOST_BLOCK,
        block_hash: b256_lo(GHOST_BLOCK + 20_000),
        tx_hash: b256_lo(99_001_234),
        log_index: 0,
        block_timestamp: None,
        contract: CONTRACT,
        event: DecodedEvent::TimeCurveSaleStarted {
            start_timestamp: u1,
            initial_deadline: u2,
            total_tokens_for_sale: U256::from(42u64),
        },
    };
    let mut tx = pool.begin().await.expect("tx begin");
    yieldomega_indexer::persist::persist_decoded_log_conn(&mut tx, &ghost_sale)
        .await
        .expect("ghost persist");
    yieldomega_indexer::reorg::upsert_indexed_block_conn(
        &mut tx,
        GHOST_BLOCK,
        ghost_sale.block_hash,
    )
    .await
    .expect("ghost ib");
    yieldomega_indexer::reorg::save_chain_pointer_conn(
        &mut tx,
        &ChainPointer {
            block_number: GHOST_BLOCK,
            block_hash: ghost_sale.block_hash,
        },
    )
    .await
    .expect("ghost ptr");
    tx.rollback().await.expect("rollback ghost");

    let p_after = load_chain_pointer(&pool).await.expect("ptr after rollback");
    assert_eq!(p_after.block_number, ptr_before_d.block_number);
    assert_eq!(p_after.block_hash, ptr_before_d.block_hash);
    assert_eq!(
        count_where(
            &pool,
            "idx_timecurve_sale_started",
            GHOST_BLOCK as i64
        )
        .await,
        0
    );
    let ib = sqlx::query("SELECT 1 FROM indexed_blocks WHERE block_number = $1")
        .bind(GHOST_BLOCK as i64)
        .fetch_optional(&pool)
        .await
        .expect("ib q");
    assert!(ib.is_none());

    // ── D) HTTP API (axum) on same pool ───────────────────────────────────
    api_http_smoke(&pool).await;
}

/// GitLab #146: block-level SQL transaction semantics — rollback drops all `persist_decoded_log_conn` rows for the tx; commit persists atomically (mirrors `ingestion::run` block ingest).
#[tokio::test]
async fn postgres_gitlab146_block_transaction_all_or_nothing_for_shared_tx_hash() {
    let Some(url) = pg_url() else {
        eprintln!("integration gitlab146 block tx: skip (set YIELDOMEGA_PG_TEST_URL)");
        return;
    };

    let pool = connect_and_migrate(&url)
        .await
        .expect("connect_and_migrate");

    let u1 = U256::from(1u8);
    let u2 = U256::from(2u8);
    let alice = addr_byte(0xa1);
    let shared_tx = 888_888u64;
    let tx_hex = format!("{:#x}", b256_lo(shared_tx));

    let buy_log = |log_index: u64| DecodedLog {
        block_number: 777,
        block_hash: b256_lo(777 + 10_000),
        tx_hash: b256_lo(shared_tx),
        log_index,
        block_timestamp: None,
        contract: CONTRACT,
        event: DecodedEvent::TimeCurveBuy {
            buyer: alice,
            charm_wad: u1,
            amount: u1,
            price_per_charm_wad: u1,
            new_deadline: u2,
            total_raised_after: u1,
            buy_index: u1,
            actual_seconds_added: U256::ZERO,
            timer_hard_reset: false,
            battle_points_after: U256::ZERO,
            bp_base_buy: U256::ZERO,
            bp_timer_reset_bonus: U256::ZERO,
            bp_clutch_bonus: U256::ZERO,
            bp_streak_break_bonus: U256::ZERO,
            bp_ambush_bonus: U256::ZERO,
            bp_flag_penalty: U256::ZERO,
            flag_planted: false,
            buyer_total_effective_timer_sec: U256::ZERO,
            buyer_active_defended_streak: U256::ZERO,
            buyer_best_defended_streak: U256::ZERO,
        },
    };

    let mut tx = pool.begin().await.expect("begin");
    persist_decoded_log_conn(&mut tx, &buy_log(0))
        .await
        .expect("persist 0");
    persist_decoded_log_conn(&mut tx, &buy_log(1))
        .await
        .expect("persist 1");
    tx.rollback().await.expect("rollback");

    let row = sqlx::query("SELECT COUNT(*)::bigint AS c FROM idx_timecurve_buy WHERE tx_hash = $1")
        .bind(&tx_hex)
        .fetch_one(&pool)
        .await
        .expect("count after rollback");
    assert_eq!(row.try_get::<i64, _>("c").unwrap(), 0);

    let mut tx = pool.begin().await.expect("begin2");
    persist_decoded_log_conn(&mut tx, &buy_log(0))
        .await
        .expect("persist 0b");
    persist_decoded_log_conn(&mut tx, &buy_log(1))
        .await
        .expect("persist 1b");
    tx.commit().await.expect("commit");

    let row = sqlx::query("SELECT COUNT(*)::bigint AS c FROM idx_timecurve_buy WHERE tx_hash = $1")
        .bind(&tx_hex)
        .fetch_one(&pool)
        .await
        .expect("count after commit");
    assert_eq!(row.try_get::<i64, _>("c").unwrap(), 2);
}


#[tokio::test]
async fn postgres_gitlab177_referrer_leaderboard_dense_rank() {
    // GitLab #177 — referrer leaderboard `rank` field must be dense-competitive (RANK() over SUM),
    // not page ordinal. Ties share the same numeric rank; the next non-tied entry skips by tie-count
    // (1, 2, 2, 4 pattern). Pagination across tie-group boundaries must not duplicate or skip referrers.
    let Some(url) = pg_url() else {
        eprintln!("integration_stage2: skip gitlab177 (set YIELDOMEGA_PG_TEST_URL)");
        return;
    };
    let pool = connect_and_migrate(&url)
        .await
        .expect("connect_and_migrate");

    // Clean slate for this test's referral rows so prior tests don't pollute the leaderboard.
    sqlx::query("DELETE FROM idx_referral_code_registered")
        .execute(&pool)
        .await
        .expect("clear referral registry table");
    sqlx::query("DELETE FROM idx_timecurve_referral_applied")
        .execute(&pool)
        .await
        .expect("clear referral table");

    // Seed 4 referrers with a controlled tie pattern:
    //   referrer A: 300 wad  -> rank 1
    //   referrer B: 200 wad  -> rank 2 (tied with C)
    //   referrer C: 200 wad  -> rank 2 (tied with B)
    //   referrer D: 100 wad  -> rank 4 (skips 3)
    let seeds: &[(&str, &str, i64)] = &[
        ("0x000000000000000000000000000000000000aaaa", "0x0000000000000000000000000000000000000001", 300),
        ("0x000000000000000000000000000000000000bbbb", "0x0000000000000000000000000000000000000002", 200),
        ("0x000000000000000000000000000000000000cccc", "0x0000000000000000000000000000000000000003", 200),
        ("0x000000000000000000000000000000000000dddd", "0x0000000000000000000000000000000000000004", 100),
    ];

    for (i, (referrer, buyer, amount)) in seeds.iter().enumerate() {
        sqlx::query(
            r#"INSERT INTO idx_timecurve_referral_applied (
                  block_number, block_hash, tx_hash, log_index, contract_address,
                  buyer, referrer, code_hash, referrer_amount, referee_amount, amount_to_fee_router
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric, $11::numeric)"#,
        )
        .bind(900_i64 + i as i64)
        .bind(format!("0x{:0>64}", i + 1))
        .bind(format!("0x{:0>64}", 100 + i + 1))
        .bind(0_i32)
        .bind("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
        .bind(*buyer)
        .bind(*referrer)
        .bind(format!("0x{:0>64}", 200 + i + 1))
        .bind(amount.to_string())
        .bind("0")
        .bind("0")
        .execute(&pool)
        .await
        .expect("seed referral row");
    }

    let app = router(AppState {
        pool: pool.clone(),
        chain_timer: Arc::new(RwLock::new(None)),
        ingestion_alive: Arc::new(AtomicBool::new(false)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(0)),
    });

    // Full leaderboard request — verify rank values directly.
    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/referrals/referrer-leaderboard?limit=10&offset=0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = response_json(res).await;
    let items = body["items"].as_array().expect("items array");
    assert_eq!(items.len(), 4, "expected 4 referrers, got {}", items.len());

    // Rank assertions — dense-competitive (RANK()), 1, 2, 2, 4 with referrer ASC tiebreaker.
    assert_eq!(items[0]["rank"].as_i64(), Some(1));
    assert_eq!(items[0]["referrer"].as_str(), Some("0x000000000000000000000000000000000000aaaa"));

    assert_eq!(items[1]["rank"].as_i64(), Some(2));
    assert_eq!(items[2]["rank"].as_i64(), Some(2));
    // Referrer ASC tiebreaker between bbbb and cccc: bbbb < cccc.
    assert_eq!(items[1]["referrer"].as_str(), Some("0x000000000000000000000000000000000000bbbb"));
    assert_eq!(items[2]["referrer"].as_str(), Some("0x000000000000000000000000000000000000cccc"));

    assert_eq!(items[3]["rank"].as_i64(), Some(4));
    assert_eq!(items[3]["referrer"].as_str(), Some("0x000000000000000000000000000000000000dddd"));

    // Paginated request crossing the tie boundary — limit=2, offset=2 must return ranks [2, 4],
    // not [3, 4] (page ordinal would have given 3, 4). Confirms rank value is leaderboard-rank, not page-position.
    let res2 = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/referrals/referrer-leaderboard?limit=2&offset=2")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res2.status(), StatusCode::OK);
    let body2 = response_json(res2).await;
    let items2 = body2["items"].as_array().expect("items array page2");
    assert_eq!(items2.len(), 2, "expected 2 rows on page 2, got {}", items2.len());
    assert_eq!(items2[0]["rank"].as_i64(), Some(2), "first row of offset=2 should still be rank 2 (tied)");
    assert_eq!(items2[0]["referrer"].as_str(), Some("0x000000000000000000000000000000000000cccc"));
    assert_eq!(items2[1]["rank"].as_i64(), Some(4), "second row of offset=2 should be rank 4 (skips 3)");
    assert_eq!(items2[1]["referrer"].as_str(), Some("0x000000000000000000000000000000000000dddd"));

    for row in items {
        assert_eq!(
            row["codes_registered_count"].as_str(),
            Some("0"),
            "gitlab177 seeds only ReferralApplied rows"
        );
    }

    // Cleanup so the test is rerunnable without leftover rows.
    sqlx::query("DELETE FROM idx_referral_code_registered")
        .execute(&pool)
        .await
        .expect("cleanup referral registry table");
    sqlx::query("DELETE FROM idx_timecurve_referral_applied")
        .execute(&pool)
        .await
        .expect("cleanup referral table");
}

#[tokio::test]
async fn postgres_gitlab204_referrer_leaderboard_includes_registry_registrations() {
    // GitLab #204 — union `idx_referral_code_registered` so guides appear before the first
    // `ReferralApplied` buy; `codes_registered_count` surfaces indexed `ReferralCodeRegistered` rows.
    let Some(url) = pg_url() else {
        eprintln!("integration_stage2: skip gitlab204 (set YIELDOMEGA_PG_TEST_URL)");
        return;
    };
    let pool = connect_and_migrate(&url)
        .await
        .expect("connect_and_migrate");

    sqlx::query("DELETE FROM idx_referral_code_registered")
        .execute(&pool)
        .await
        .expect("clear referral registry table");
    sqlx::query("DELETE FROM idx_timecurve_referral_applied")
        .execute(&pool)
        .await
        .expect("clear referral applied table");

    sqlx::query(
        r#"INSERT INTO idx_referral_code_registered (
              block_number, block_hash, tx_hash, log_index, contract_address,
              owner_address, code_hash, normalized_code
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(800_i64)
    .bind(format!("0x{:0>64}", 50))
    .bind(format!("0x{:0>64}", 60))
    .bind(0_i32)
    .bind("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .bind("0x0000000000000000000000000000000000000e01")
    .bind(format!("0x{:0>64}", 70))
    .bind("code1")
    .execute(&pool)
    .await
    .expect("seed registry row 0");

    sqlx::query(
        r#"INSERT INTO idx_referral_code_registered (
              block_number, block_hash, tx_hash, log_index, contract_address,
              owner_address, code_hash, normalized_code
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"#,
    )
    .bind(801_i64)
    .bind(format!("0x{:0>64}", 51))
    .bind(format!("0x{:0>64}", 61))
    .bind(0_i32)
    .bind("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
    .bind("0x0000000000000000000000000000000000000e02")
    .bind(format!("0x{:0>64}", 71))
    .bind("code2")
    .execute(&pool)
    .await
    .expect("seed registry row 1");

    let app = router(AppState {
        pool: pool.clone(),
        chain_timer: Arc::new(RwLock::new(None)),
        ingestion_alive: Arc::new(AtomicBool::new(false)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(0)),
    });

    let res = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/v1/referrals/referrer-leaderboard?limit=10&offset=0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let body = response_json(res).await;
    let items = body["items"].as_array().expect("items array");
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["referrer"].as_str(), Some("0x0000000000000000000000000000000000000e01"));
    assert_eq!(items[0]["rank"].as_i64(), Some(1));
    assert_eq!(items[0]["codes_registered_count"].as_str(), Some("1"));
    assert_eq!(items[0]["referred_buy_count"].as_str(), Some("0"));
    assert_eq!(items[0]["total_referrer_charm_wad"].as_str(), Some("0"));
    assert_eq!(items[1]["referrer"].as_str(), Some("0x0000000000000000000000000000000000000e02"));
    assert_eq!(items[1]["rank"].as_i64(), Some(1));

    sqlx::query(
        r#"INSERT INTO idx_timecurve_referral_applied (
              block_number, block_hash, tx_hash, log_index, contract_address,
              buyer, referrer, code_hash, referrer_amount, referee_amount, amount_to_fee_router
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric, $11::numeric)"#,
    )
    .bind(850_i64)
    .bind("0x00000000000000000000000000000000000000000000000000000000000000aa")
    .bind("0x00000000000000000000000000000000000000000000000000000000000000bb")
    .bind(0_i32)
    .bind("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")
    .bind("0x00000000000000000000000000000000000000b1")
    .bind("0x0000000000000000000000000000000000000dd1")
    .bind("0x00000000000000000000000000000000000000000000000000000000000000cc")
    .bind("500")
    .bind("0")
    .bind("0")
    .execute(&pool)
    .await
    .expect("seed referral applied for high-score referrer");

    let res2 = app
        .oneshot(
            Request::builder()
                .uri("/v1/referrals/referrer-leaderboard?limit=10&offset=0")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(res2.status(), StatusCode::OK);
    let body2 = response_json(res2).await;
    let items2 = body2["items"].as_array().expect("items array after applied insert");
    assert_eq!(items2.len(), 3);
    assert_eq!(
        items2[0]["referrer"].as_str(),
        Some("0x0000000000000000000000000000000000000dd1")
    );
    assert_eq!(items2[0]["rank"].as_i64(), Some(1));
    assert_eq!(items2[0]["codes_registered_count"].as_str(), Some("0"));
    assert_eq!(items2[1]["rank"].as_i64(), Some(2));
    assert_eq!(items2[1]["referrer"].as_str(), Some("0x0000000000000000000000000000000000000e01"));
    assert_eq!(items2[1]["codes_registered_count"].as_str(), Some("1"));
    assert_eq!(items2[2]["rank"].as_i64(), Some(2));
    assert_eq!(items2[2]["referrer"].as_str(), Some("0x0000000000000000000000000000000000000e02"));
    assert_eq!(items2[2]["codes_registered_count"].as_str(), Some("1"));

    sqlx::query("DELETE FROM idx_referral_code_registered")
        .execute(&pool)
        .await
        .expect("cleanup referral registry table");
    sqlx::query("DELETE FROM idx_timecurve_referral_applied")
        .execute(&pool)
        .await
        .expect("cleanup referral applied table");
}

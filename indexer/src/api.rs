// SPDX-License-Identifier: AGPL-3.0-or-later

//! HTTP API (axum): paginated reads for frontend and agents.

use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use serde::Serialize;
use serde_json::json;
use sqlx::{PgPool, Row};

/// Current API schema version — bump when response shapes change.
const SCHEMA_VERSION: &str = "1.5.0";

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
}

#[derive(Debug, serde::Deserialize)]
pub struct PageParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    /// Filter rabbit tables by user address (0x…).
    pub user: Option<String>,
}

fn default_limit() -> i64 {
    50
}

fn clamp_limit(l: i64) -> i64 {
    l.clamp(1, 200)
}

pub fn router(state: AppState) -> Router {
    Router::new()
        .route("/healthz", get(healthz))
        .route("/v1/status", get(status))
        .route("/v1/timecurve/buys", get(timecurve_buys))
        .route(
            "/v1/timecurve/warbow/battle-feed",
            get(timecurve_warbow_battle_feed),
        )
        .route(
            "/v1/timecurve/warbow/leaderboard",
            get(timecurve_warbow_leaderboard),
        )
        .route(
            "/v1/timecurve/warbow/steals-by-victim-day",
            get(timecurve_warbow_steals_by_victim_day),
        )
        .route(
            "/v1/timecurve/warbow/guard-latest",
            get(timecurve_warbow_guard_latest),
        )
        .route("/v1/timecurve/buyer-stats", get(timecurve_buyer_stats))
        .route("/v1/rabbit/deposits", get(rabbit_deposits))
        .route("/v1/rabbit/withdrawals", get(rabbit_withdrawals))
        .route("/v1/rabbit/health-epochs", get(rabbit_health_epochs))
        .route(
            "/v1/timecurve/charm-redemptions",
            get(timecurve_charm_redemptions),
        )
        .route("/v1/leprechauns/mints", get(leprechaun_mints))
        .route(
            "/v1/timecurve/prize-distributions",
            get(timecurve_prize_distributions),
        )
        .route("/v1/timecurve/prize-payouts", get(timecurve_prize_payouts))
        .route("/v1/referrals/registrations", get(referral_registrations))
        .route("/v1/referrals/applied", get(referral_applied))
        .route(
            "/v1/fee-router/sinks-updates",
            get(fee_router_sinks_updates),
        )
        .route(
            "/v1/fee-router/fees-distributed",
            get(fee_router_fees_distributed),
        )
        .route("/v1/rabbit/faction-stats", get(rabbit_faction_stats))
        .with_state(state)
}

fn with_schema_version(headers: axum::http::HeaderMap) -> axum::http::HeaderMap {
    let mut h = headers;
    h.insert(
        header::HeaderName::from_static("x-schema-version"),
        SCHEMA_VERSION.parse().unwrap(),
    );
    h
}

async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn status(State(state): State<AppState>) -> Response {
    let db_ok = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&state.pool)
        .await
        .is_ok();

    let chain_pointer = sqlx::query("SELECT value FROM indexer_state WHERE key = 'chain_pointer'")
        .fetch_optional(&state.pool)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<serde_json::Value, _>("value").ok());

    let max_block: Option<i64> = sqlx::query_scalar::<_, Option<i64>>(
        "SELECT MAX(block_number)::bigint FROM indexed_blocks",
    )
    .fetch_one(&state.pool)
    .await
    .ok()
    .flatten();

    let body = json!({
        "schema_version": SCHEMA_VERSION,
        "database_connected": db_ok,
        "chain_pointer": chain_pointer,
        "max_indexed_block": max_block,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct BuyRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    buyer: String,
    amount: String,
    charm_wad: String,
    price_per_charm_wad: String,
    new_deadline: String,
    total_raised_after: String,
    buy_index: String,
    actual_seconds_added: String,
    timer_hard_reset: bool,
    battle_points_after: String,
    bp_base_buy: String,
    bp_timer_reset_bonus: String,
    bp_clutch_bonus: String,
    bp_streak_break_bonus: String,
    bp_ambush_bonus: String,
    bp_flag_penalty: String,
    flag_planted: bool,
    buyer_total_effective_timer_sec: String,
    buyer_active_defended_streak: String,
    buyer_best_defended_streak: String,
}

async fn timecurve_buys(State(state): State<AppState>, Query(p): Query<PageParams>) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index, buyer,
                  amount::text AS amount,
                  COALESCE(charm_wad, amount)::text AS charm_wad,
                  COALESCE(price_per_charm_wad, current_min_buy, 0)::text AS price_per_charm_wad,
                  new_deadline::text AS new_deadline, total_raised_after::text AS total_raised_after,
                  buy_index::text AS buy_index,
                  COALESCE(actual_seconds_added, 0)::text AS actual_seconds_added,
                  COALESCE(timer_hard_reset, false) AS timer_hard_reset,
                  COALESCE(battle_points_after, 0)::text AS battle_points_after,
                  COALESCE(bp_base_buy, 0)::text AS bp_base_buy,
                  COALESCE(bp_timer_reset_bonus, 0)::text AS bp_timer_reset_bonus,
                  COALESCE(bp_clutch_bonus, 0)::text AS bp_clutch_bonus,
                  COALESCE(bp_streak_break_bonus, 0)::text AS bp_streak_break_bonus,
                  COALESCE(bp_ambush_bonus, 0)::text AS bp_ambush_bonus,
                  COALESCE(bp_flag_penalty, 0)::text AS bp_flag_penalty,
                  COALESCE(flag_planted, false) AS flag_planted,
                  COALESCE(buyer_total_effective_timer_sec, 0)::text AS buyer_total_effective_timer_sec,
                  COALESCE(buyer_active_defended_streak, 0)::text AS buyer_active_defended_streak,
                  COALESCE(buyer_best_defended_streak, 0)::text AS buyer_best_defended_streak
           FROM idx_timecurve_buy
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<BuyRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(BuyRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                buyer: r.try_get("buyer").ok()?,
                amount: r.try_get("amount").ok()?,
                charm_wad: r.try_get("charm_wad").ok()?,
                price_per_charm_wad: r.try_get("price_per_charm_wad").ok()?,
                new_deadline: r.try_get("new_deadline").ok()?,
                total_raised_after: r.try_get("total_raised_after").ok()?,
                buy_index: r.try_get("buy_index").ok()?,
                actual_seconds_added: r.try_get("actual_seconds_added").ok()?,
                timer_hard_reset: r.try_get("timer_hard_reset").ok()?,
                battle_points_after: r.try_get("battle_points_after").ok()?,
                bp_base_buy: r.try_get("bp_base_buy").ok()?,
                bp_timer_reset_bonus: r.try_get("bp_timer_reset_bonus").ok()?,
                bp_clutch_bonus: r.try_get("bp_clutch_bonus").ok()?,
                bp_streak_break_bonus: r.try_get("bp_streak_break_bonus").ok()?,
                bp_ambush_bonus: r.try_get("bp_ambush_bonus").ok()?,
                bp_flag_penalty: r.try_get("bp_flag_penalty").ok()?,
                flag_planted: r.try_get("flag_planted").ok()?,
                buyer_total_effective_timer_sec: r.try_get("buyer_total_effective_timer_sec").ok()?,
                buyer_active_defended_streak: r.try_get("buyer_active_defended_streak").ok()?,
                buyer_best_defended_streak: r.try_get("buyer_best_defended_streak").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct WarBowBattleFeedRow {
    kind: String,
    block_number: String,
    log_index: i32,
    tx_hash: String,
    /// Unix seconds when the RPC log included `blockTimestamp`; null if unknown.
    block_timestamp: Option<String>,
    detail: serde_json::Value,
}

async fn timecurve_warbow_battle_feed(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"WITH u AS (
            SELECT 'steal'::text AS kind, block_number, log_index, tx_hash,
                   block_timestamp::text AS block_timestamp,
                   jsonb_build_object(
                     'attacker', attacker,
                     'victim', victim,
                     'amount_bp', amount_bp::text,
                     'burn_paid_wad', burn_paid_wad::text,
                     'bypassed_victim_daily_limit', bypassed_victim_daily_limit,
                     'victim_bp_after', victim_bp_after::text,
                     'attacker_bp_after', attacker_bp_after::text
                   ) AS detail
            FROM idx_timecurve_warbow_steal
            UNION ALL
            SELECT 'revenge', block_number, log_index, tx_hash,
                   block_timestamp::text,
                   jsonb_build_object(
                     'avenger', avenger,
                     'stealer', stealer,
                     'amount_bp', amount_bp::text,
                     'burn_paid_wad', burn_paid_wad::text
                   )
            FROM idx_timecurve_warbow_revenge
            UNION ALL
            SELECT 'guard_activated', block_number, log_index, tx_hash,
                   block_timestamp::text,
                   jsonb_build_object(
                     'player', player,
                     'guard_until_ts', guard_until_ts::text,
                     'burn_paid_wad', burn_paid_wad::text
                   )
            FROM idx_timecurve_warbow_guard
            UNION ALL
            SELECT 'flag_claimed', block_number, log_index, tx_hash,
                   block_timestamp::text,
                   jsonb_build_object(
                     'player', player,
                     'bonus_bp', bonus_bp::text,
                     'battle_points_after', battle_points_after::text
                   )
            FROM idx_timecurve_warbow_flag_claimed
            UNION ALL
            SELECT 'flag_penalized', block_number, log_index, tx_hash,
                   block_timestamp::text,
                   jsonb_build_object(
                     'former_holder', former_holder,
                     'penalty_bp', penalty_bp::text,
                     'triggering_buyer', triggering_buyer,
                     'battle_points_after', battle_points_after::text
                   )
            FROM idx_timecurve_warbow_flag_penalized
        )
        SELECT kind, block_number::text AS block_number, log_index, tx_hash, block_timestamp, detail
        FROM u
        ORDER BY block_number DESC, log_index ASC
        LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<WarBowBattleFeedRow> = rows
        .into_iter()
        .filter_map(|r| {
            let detail: serde_json::Value = r.try_get::<serde_json::Value, _>("detail").ok()?;
            Some(WarBowBattleFeedRow {
                kind: r.try_get("kind").ok()?,
                block_number: r.try_get("block_number").ok()?,
                log_index: r.try_get("log_index").ok()?,
                tx_hash: r.try_get("tx_hash").ok()?,
                block_timestamp: r.try_get("block_timestamp").ok(),
                detail,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
        "note": "UTC-day steal limits use floor(block_timestamp/86400) when block_timestamp is present; otherwise resolve block time from an RPC.",
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct WarBowLeaderboardRow {
    buyer: String,
    battle_points_after: String,
    block_number: String,
    tx_hash: String,
    log_index: i32,
}

async fn timecurve_warbow_leaderboard(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT buyer,
                  battle_points_after::text AS battle_points_after,
                  block_number::text AS block_number,
                  tx_hash,
                  log_index
           FROM (
             SELECT DISTINCT ON (LOWER(buyer)) buyer, battle_points_after, block_number, tx_hash, log_index
             FROM idx_timecurve_buy
             ORDER BY LOWER(buyer), block_number DESC, log_index DESC
           ) latest
           ORDER BY battle_points_after::numeric DESC, block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<WarBowLeaderboardRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(WarBowLeaderboardRow {
                buyer: r.try_get("buyer").ok()?,
                battle_points_after: r.try_get("battle_points_after").ok()?,
                block_number: r.try_get("block_number").ok()?,
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
        "note": "Per-wallet Battle Points are taken from the latest indexed Buy row for that buyer (matches onchain running total at last buy).",
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Debug, serde::Deserialize)]
pub struct WarBowVictimQuery {
    pub victim: String,
}

#[derive(Serialize)]
struct WarBowVictimDayRow {
    /// Unix day = floor(block_timestamp / 86400) in UTC.
    utc_day: String,
    steal_count: String,
}

async fn timecurve_warbow_steals_by_victim_day(
    State(state): State<AppState>,
    Query(q): Query<WarBowVictimQuery>,
) -> Response {
    if !valid_0x_address20(&q.victim) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "victim must be a 0x-prefixed 20-byte address" })),
        )
            .into_response();
    }

    let rows = sqlx::query(
        r#"SELECT (block_timestamp / 86400)::text AS utc_day,
                  COUNT(*)::text AS steal_count
           FROM idx_timecurve_warbow_steal
           WHERE LOWER(victim) = LOWER($1)
             AND block_timestamp IS NOT NULL
           GROUP BY (block_timestamp / 86400)
           ORDER BY (block_timestamp / 86400) DESC
           LIMIT 366"#,
    )
    .bind(&q.victim)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<WarBowVictimDayRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(WarBowVictimDayRow {
                utc_day: r.try_get("utc_day").ok()?,
                steal_count: r.try_get("steal_count").ok()?,
            })
        })
        .collect();

    let body = json!({
        "victim": q.victim,
        "items": items,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Debug, serde::Deserialize)]
pub struct WarBowPlayerQuery {
    pub player: String,
}

#[derive(Serialize)]
struct WarBowGuardLatestRow {
    player: String,
    guard_until_ts: String,
    burn_paid_wad: String,
    block_number: String,
    tx_hash: String,
    log_index: i32,
    block_timestamp: Option<String>,
}

async fn timecurve_warbow_guard_latest(
    State(state): State<AppState>,
    Query(q): Query<WarBowPlayerQuery>,
) -> Response {
    if !valid_0x_address20(&q.player) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "player must be a 0x-prefixed 20-byte address" })),
        )
            .into_response();
    }

    let row = sqlx::query(
        r#"SELECT player, guard_until_ts::text AS guard_until_ts, burn_paid_wad::text AS burn_paid_wad,
                  block_number::text AS block_number, tx_hash, log_index,
                  block_timestamp::text AS block_timestamp
           FROM idx_timecurve_warbow_guard
           WHERE LOWER(player) = LOWER($1)
           ORDER BY block_number DESC, log_index DESC
           LIMIT 1"#,
    )
    .bind(&q.player)
    .fetch_optional(&state.pool)
    .await;

    let row = match row {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let item = row.and_then(|r| {
        Some(WarBowGuardLatestRow {
            player: r.try_get("player").ok()?,
            guard_until_ts: r.try_get("guard_until_ts").ok()?,
            burn_paid_wad: r.try_get("burn_paid_wad").ok()?,
            block_number: r.try_get("block_number").ok()?,
            tx_hash: r.try_get("tx_hash").ok()?,
            log_index: r.try_get("log_index").ok()?,
            block_timestamp: r.try_get("block_timestamp").ok(),
        })
    });

    let body = json!({
        "player": q.player,
        "latest_guard_activation": item,
        "note": "Compare guard_until_ts to the chain head timestamp to know if guard is active.",
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Debug, serde::Deserialize)]
pub struct BuyerStatsQuery {
    pub buyer: String,
}

fn valid_0x_address20(s: &str) -> bool {
    s.starts_with("0x") && s.len() == 42 && s[2..].chars().all(|c| c.is_ascii_hexdigit())
}

async fn timecurve_buyer_stats(
    State(state): State<AppState>,
    Query(q): Query<BuyerStatsQuery>,
) -> Response {
    if !valid_0x_address20(&q.buyer) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "buyer must be a 0x-prefixed 20-byte address" })),
        )
            .into_response();
    }

    let row = sqlx::query(
        r#"SELECT COALESCE(SUM(COALESCE(charm_wad, amount)), 0)::text AS indexed_charm_weight,
                  COUNT(*)::text AS indexed_buy_count
           FROM idx_timecurve_buy
           WHERE LOWER(buyer) = LOWER($1)"#,
    )
    .bind(&q.buyer)
    .fetch_one(&state.pool)
    .await;

    let row = match row {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let indexed_charm_weight: String = row
        .try_get("indexed_charm_weight")
        .unwrap_or_else(|_| "0".into());
    let indexed_buy_count: String = row
        .try_get("indexed_buy_count")
        .unwrap_or_else(|_| "0".into());

    let body = json!({
        "buyer": q.buyer,
        "indexed_charm_weight": indexed_charm_weight,
        "indexed_buy_count": indexed_buy_count,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct DepositRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    user_address: String,
    reserve_asset: String,
    amount: String,
    doub_out: String,
    epoch_id: String,
    faction_id: String,
}

async fn rabbit_deposits(State(state): State<AppState>, Query(p): Query<PageParams>) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let result = if let Some(ref u) = p.user {
        if !valid_0x_address20(u) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "user must be a 0x-prefixed 20-byte address" })),
            )
                .into_response();
        }
        sqlx::query(
            r#"SELECT block_number, tx_hash, log_index, user_address, reserve_asset,
                      amount::text AS amount, doub_out::text AS doub_out,
                      epoch_id::text AS epoch_id, faction_id::text AS faction_id
               FROM idx_rabbit_deposit
               WHERE LOWER(user_address) = LOWER($3)
               ORDER BY block_number DESC, log_index ASC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(lim)
        .bind(off)
        .bind(u)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query(
            r#"SELECT block_number, tx_hash, log_index, user_address, reserve_asset,
                      amount::text AS amount, doub_out::text AS doub_out,
                      epoch_id::text AS epoch_id, faction_id::text AS faction_id
               FROM idx_rabbit_deposit
               ORDER BY block_number DESC, log_index ASC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(lim)
        .bind(off)
        .fetch_all(&state.pool)
        .await
    };

    let rows = match result {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<DepositRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(DepositRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                user_address: r.try_get("user_address").ok()?,
                reserve_asset: r.try_get("reserve_asset").ok()?,
                amount: r.try_get("amount").ok()?,
                doub_out: r.try_get("doub_out").ok()?,
                epoch_id: r.try_get("epoch_id").ok()?,
                faction_id: r.try_get("faction_id").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct WithdrawalRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    user_address: String,
    reserve_asset: String,
    amount: String,
    doub_in: String,
    epoch_id: String,
    faction_id: String,
}

async fn rabbit_withdrawals(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let result = if let Some(ref u) = p.user {
        if !valid_0x_address20(u) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "user must be a 0x-prefixed 20-byte address" })),
            )
                .into_response();
        }
        sqlx::query(
            r#"SELECT block_number, tx_hash, log_index, user_address, reserve_asset,
                      amount::text AS amount, doub_in::text AS doub_in,
                      epoch_id::text AS epoch_id, faction_id::text AS faction_id
               FROM idx_rabbit_withdrawal
               WHERE LOWER(user_address) = LOWER($3)
               ORDER BY block_number DESC, log_index ASC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(lim)
        .bind(off)
        .bind(u)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query(
            r#"SELECT block_number, tx_hash, log_index, user_address, reserve_asset,
                      amount::text AS amount, doub_in::text AS doub_in,
                      epoch_id::text AS epoch_id, faction_id::text AS faction_id
               FROM idx_rabbit_withdrawal
               ORDER BY block_number DESC, log_index ASC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(lim)
        .bind(off)
        .fetch_all(&state.pool)
        .await
    };

    let rows = match result {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<WithdrawalRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(WithdrawalRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                user_address: r.try_get("user_address").ok()?,
                reserve_asset: r.try_get("reserve_asset").ok()?,
                amount: r.try_get("amount").ok()?,
                doub_in: r.try_get("doub_in").ok()?,
                epoch_id: r.try_get("epoch_id").ok()?,
                faction_id: r.try_get("faction_id").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct HealthEpochRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    epoch_id: String,
    finalized_at: String,
    reserve_ratio_wad: String,
    doub_total_supply: String,
    repricing_factor_wad: String,
    backing_per_doubloon_wad: String,
    internal_state_e_wad: String,
}

async fn rabbit_health_epochs(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index,
                  epoch_id::text AS epoch_id, finalized_at::text AS finalized_at,
                  reserve_ratio_wad::text AS reserve_ratio_wad,
                  doub_total_supply::text AS doub_total_supply,
                  repricing_factor_wad::text AS repricing_factor_wad,
                  backing_per_doubloon_wad::text AS backing_per_doubloon_wad,
                  internal_state_e_wad::text AS internal_state_e_wad
           FROM idx_rabbit_health_epoch_finalized
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<HealthEpochRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(HealthEpochRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                epoch_id: r.try_get("epoch_id").ok()?,
                finalized_at: r.try_get("finalized_at").ok()?,
                reserve_ratio_wad: r.try_get("reserve_ratio_wad").ok()?,
                doub_total_supply: r.try_get("doub_total_supply").ok()?,
                repricing_factor_wad: r.try_get("repricing_factor_wad").ok()?,
                backing_per_doubloon_wad: r.try_get("backing_per_doubloon_wad").ok()?,
                internal_state_e_wad: r.try_get("internal_state_e_wad").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct CharmRedemptionRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    buyer: String,
    token_amount: String,
}

async fn timecurve_charm_redemptions(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index, buyer, token_amount::text AS token_amount
           FROM idx_timecurve_charms_redeemed
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<CharmRedemptionRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(CharmRedemptionRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                buyer: r.try_get("buyer").ok()?,
                token_amount: r.try_get("token_amount").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct MintRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    token_id: String,
    series_id: String,
    to_address: String,
}

async fn leprechaun_mints(State(state): State<AppState>, Query(p): Query<PageParams>) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index,
                  token_id::text AS token_id, series_id::text AS series_id, to_address
           FROM idx_nft_minted
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<MintRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(MintRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                token_id: r.try_get("token_id").ok()?,
                series_id: r.try_get("series_id").ok()?,
                to_address: r.try_get("to_address").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Debug, serde::Deserialize)]
pub struct ReferralAppliedQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    pub referrer: Option<String>,
}

#[derive(Serialize)]
struct PrizeDistributionRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    contract_address: String,
}

async fn timecurve_prize_distributions(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index, contract_address
           FROM idx_timecurve_prizes_distributed
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<PrizeDistributionRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(PrizeDistributionRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                contract_address: r.try_get("contract_address").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct PrizePayoutRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    winner: String,
    token: String,
    amount: String,
    category: i16,
    placement: i16,
}

async fn timecurve_prize_payouts(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index,
                  winner, token, amount::text AS amount, category, placement
           FROM idx_podium_pool_paid
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<PrizePayoutRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(PrizePayoutRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                winner: r.try_get("winner").ok()?,
                token: r.try_get("token").ok()?,
                amount: r.try_get("amount").ok()?,
                category: r.try_get("category").ok()?,
                placement: r.try_get("placement").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct ReferralRegistrationRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    owner_address: String,
    code_hash: String,
    normalized_code: String,
}

async fn referral_registrations(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index, owner_address, code_hash, normalized_code
           FROM idx_referral_code_registered
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<ReferralRegistrationRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(ReferralRegistrationRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                owner_address: r.try_get("owner_address").ok()?,
                code_hash: r.try_get("code_hash").ok()?,
                normalized_code: r.try_get("normalized_code").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct ReferralAppliedRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    buyer: String,
    referrer: String,
    code_hash: String,
    referrer_amount: String,
    referee_amount: String,
    amount_to_fee_router: String,
}

async fn referral_applied(
    State(state): State<AppState>,
    Query(p): Query<ReferralAppliedQuery>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    if let Some(ref addr) = p.referrer {
        if !valid_0x_address20(addr) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "referrer must be a 0x-prefixed 20-byte address" })),
            )
                .into_response();
        }
    }

    let rows = if let Some(ref addr) = p.referrer {
        let addr_l = addr.to_lowercase();
        sqlx::query(
            r#"SELECT block_number, tx_hash, log_index, buyer, referrer, code_hash,
                      referrer_amount::text AS referrer_amount,
                      referee_amount::text AS referee_amount,
                      amount_to_fee_router::text AS amount_to_fee_router
               FROM idx_timecurve_referral_applied
               WHERE lower(referrer) = lower($3)
               ORDER BY block_number DESC, log_index ASC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(lim)
        .bind(off)
        .bind(addr_l)
        .fetch_all(&state.pool)
        .await
    } else {
        sqlx::query(
            r#"SELECT block_number, tx_hash, log_index, buyer, referrer, code_hash,
                      referrer_amount::text AS referrer_amount,
                      referee_amount::text AS referee_amount,
                      amount_to_fee_router::text AS amount_to_fee_router
               FROM idx_timecurve_referral_applied
               ORDER BY block_number DESC, log_index ASC
               LIMIT $1 OFFSET $2"#,
        )
        .bind(lim)
        .bind(off)
        .fetch_all(&state.pool)
        .await
    };

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<ReferralAppliedRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(ReferralAppliedRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                buyer: r.try_get("buyer").ok()?,
                referrer: r.try_get("referrer").ok()?,
                code_hash: r.try_get("code_hash").ok()?,
                referrer_amount: r.try_get("referrer_amount").ok()?,
                referee_amount: r.try_get("referee_amount").ok()?,
                amount_to_fee_router: r.try_get("amount_to_fee_router").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct FeeRouterSinksUpdateRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    contract_address: String,
    actor: String,
    old_sinks_json: String,
    new_sinks_json: String,
}

async fn fee_router_sinks_updates(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index, contract_address, actor,
                  old_sinks_json, new_sinks_json
           FROM idx_fee_router_sinks_updated
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<FeeRouterSinksUpdateRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(FeeRouterSinksUpdateRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                contract_address: r.try_get("contract_address").ok()?,
                actor: r.try_get("actor").ok()?,
                old_sinks_json: r.try_get("old_sinks_json").ok()?,
                new_sinks_json: r.try_get("new_sinks_json").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct FeeRouterFeesDistributedRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    contract_address: String,
    token: String,
    amount: String,
    shares_json: String,
}

async fn fee_router_fees_distributed(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index, contract_address, token,
                  amount::text AS amount, shares_json
           FROM idx_fee_router_fees_distributed
           ORDER BY block_number DESC, log_index ASC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<FeeRouterFeesDistributedRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(FeeRouterFeesDistributedRow {
                block_number: r.try_get::<i64, _>("block_number").ok()?.to_string(),
                tx_hash: r.try_get("tx_hash").ok()?,
                log_index: r.try_get("log_index").ok()?,
                contract_address: r.try_get("contract_address").ok()?,
                token: r.try_get("token").ok()?,
                amount: r.try_get("amount").ok()?,
                shares_json: r.try_get("shares_json").ok()?,
            })
        })
        .collect();

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct FactionStatRow {
    faction_id: String,
    net_deposits: String,
    deposit_count: String,
    withdrawal_count: String,
}

async fn rabbit_faction_stats(State(state): State<AppState>) -> Response {
    let rows = sqlx::query(
        r#"WITH dep AS (
               SELECT faction_id, SUM(amount) AS dep_amt, COUNT(*)::bigint AS dep_cnt
               FROM idx_rabbit_deposit
               GROUP BY faction_id
           ),
           wit AS (
               SELECT faction_id, SUM(amount) AS wit_amt, COUNT(*)::bigint AS wit_cnt
               FROM idx_rabbit_withdrawal
               GROUP BY faction_id
           ),
           joined AS (
               SELECT COALESCE(dep.faction_id, wit.faction_id) AS faction_id,
                      (COALESCE(dep.dep_amt, 0) - COALESCE(wit.wit_amt, 0)) AS net_amt,
                      COALESCE(dep.dep_cnt, 0) AS deposit_count,
                      COALESCE(wit.wit_cnt, 0) AS withdrawal_count
               FROM dep
               FULL OUTER JOIN wit ON dep.faction_id = wit.faction_id
           )
           SELECT faction_id::text AS faction_id,
                  net_amt::text AS net_deposits,
                  deposit_count::text AS deposit_count,
                  withdrawal_count::text AS withdrawal_count
           FROM joined
           ORDER BY net_amt DESC NULLS LAST"#,
    )
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({ "error": e.to_string() })),
            )
                .into_response();
        }
    };

    let items: Vec<FactionStatRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(FactionStatRow {
                faction_id: r.try_get::<String, _>("faction_id").ok()?,
                net_deposits: r.try_get("net_deposits").ok()?,
                deposit_count: r.try_get("deposit_count").ok()?,
                withdrawal_count: r.try_get("withdrawal_count").ok()?,
            })
        })
        .collect();

    let body = json!({ "items": items });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[cfg(test)]
mod address_validation_tests {
    use super::valid_0x_address20;

    #[test]
    fn valid_0x_address20_accepts_20_byte_hex() {
        assert!(valid_0x_address20(
            "0xdddddddddddddddddddddddddddddddddddddddd"
        ));
        assert!(valid_0x_address20(
            "0x0000000000000000000000000000000000000000"
        ));
    }

    #[test]
    fn valid_0x_address20_rejects_invalid() {
        assert!(!valid_0x_address20("0xbad"));
        assert!(!valid_0x_address20("not-an-address"));
        assert!(!valid_0x_address20(""));
        assert!(!valid_0x_address20(
            "0xddddddddddddddddddddddddddddddddddddddddd"
        ));
        assert!(!valid_0x_address20(
            "0xgggggggggggggggggggggggggggggggggggggg"
        ));
    }
}

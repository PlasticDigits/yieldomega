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
const SCHEMA_VERSION: &str = "1.4.0";

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
    current_min_buy: String,
    new_deadline: String,
    total_raised_after: String,
    buy_index: String,
}

async fn timecurve_buys(State(state): State<AppState>, Query(p): Query<PageParams>) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let rows = sqlx::query(
        r#"SELECT block_number, tx_hash, log_index, buyer,
                  amount::text AS amount, current_min_buy::text AS current_min_buy,
                  new_deadline::text AS new_deadline, total_raised_after::text AS total_raised_after,
                  buy_index::text AS buy_index
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
                current_min_buy: r.try_get("current_min_buy").ok()?,
                new_deadline: r.try_get("new_deadline").ok()?,
                total_raised_after: r.try_get("total_raised_after").ok()?,
                buy_index: r.try_get("buy_index").ok()?,
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
        r#"SELECT COALESCE(SUM(amount), 0)::text AS indexed_charm_weight,
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
        if !u.starts_with("0x") || u.len() != 42 {
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
        if !u.starts_with("0x") || u.len() != 42 {
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

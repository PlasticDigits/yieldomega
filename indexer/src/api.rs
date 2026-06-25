// SPDX-License-Identifier: AGPL-3.0-or-later

//! HTTP API (axum): Arena v2 reads and referral surfaces.

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;

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
use tokio::sync::RwLock;

use crate::api_validate::valid_0x_address20;
use crate::chain_timer::TimecurveHeadSnapshot;
use crate::rpc_metrics::RpcMetrics;

const SCHEMA_VERSION: &str = "2.19.0";

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub chain_timer: Arc<RwLock<Option<TimecurveHeadSnapshot>>>,
    pub ingestion_alive: Arc<AtomicBool>,
    pub last_indexed_at_ms: Arc<AtomicU64>,
    pub rpc_metrics: RpcMetrics,
}

#[derive(Debug, serde::Deserialize)]
pub struct PageParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
}

pub(crate) fn default_limit() -> i64 {
    50
}

fn clamp_limit(l: i64) -> i64 {
    l.clamp(1, 200)
}

/// When true, [`status_ops`] serves detailed metrics on `GET /v1/status/ops`.
pub fn expose_ops_metrics() -> bool {
    std::env::var("INDEXER_EXPOSE_OPS_METRICS")
        .ok()
        .is_some_and(|s| matches!(s.trim().to_lowercase().as_str(), "1" | "true" | "yes"))
}

pub fn router(state: AppState) -> Router {
    build_router(state, false)
}

/// HTTP router with optional per-peer rate limiting on all routes except `/healthz`.
pub fn router_with_rate_limit(state: AppState) -> Router {
    build_router(state, true)
}

fn build_router(state: AppState, rate_limit: bool) -> Router {
    let health = Router::new().route("/healthz", get(healthz));
    let mut api = Router::new()
        .route("/v1/status", get(status))
        .route("/v1/status/ops", get(status_ops))
        .merge(crate::api_arena::arena_routes())
        .route("/v1/referrals/registrations", get(referral_registrations))
        .route("/v1/referrals/applied", get(referral_applied))
        .route(
            "/v1/referrals/referrer-leaderboard",
            get(referral_referrer_leaderboard),
        )
        .route(
            "/v1/referrals/wallet-cred-summary",
            get(referral_wallet_cred_summary),
        )
        .route(
            "/v1/referrals/wallet-charm-summary",
            get(referral_wallet_cred_summary),
        );
    if rate_limit {
        if let Some(settings) = crate::rate_limit::RateLimitSettings::from_env() {
            tracing::info!(
                per_min = settings.per_min.get(),
                burst = settings.burst.get(),
                trust_proxy = settings.trust_proxy,
                "indexer HTTP rate limiting enabled"
            );
            api = crate::rate_limit::apply_to_routes(api, settings);
        }
    }
    health.merge(api).with_state(state)
}

pub(crate) fn with_schema_version(headers: axum::http::HeaderMap) -> axum::http::HeaderMap {
    let mut h = headers;
    h.insert(
        header::HeaderName::from_static("x-schema-version"),
        SCHEMA_VERSION.parse().unwrap(),
    );
    h
}

const PUBLIC_INTERNAL_DB_ERROR: &str = "internal server error";

pub(crate) fn internal_db_error_response(context: &'static str, err: sqlx::Error) -> Response {
    tracing::error!(error = %err, context, "indexer API: database query failed");
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": PUBLIC_INTERNAL_DB_ERROR })),
    )
        .into_response()
}

/// Fail the request when a projected column cannot be read (no silent row drops).
pub(crate) fn pg_row_get<'r, T>(row: &'r sqlx::postgres::PgRow, col: &str) -> Result<T, sqlx::Error>
where
    T: sqlx::Decode<'r, sqlx::Postgres> + sqlx::Type<sqlx::Postgres> + Send + Unpin,
{
    row.try_get(col)
}

#[allow(clippy::result_large_err)]
pub(crate) fn pg_row_required<'r, T>(
    row: &'r sqlx::postgres::PgRow,
    col: &str,
    context: &'static str,
) -> Result<T, Response>
where
    T: sqlx::Decode<'r, sqlx::Postgres> + sqlx::Type<sqlx::Postgres> + Send + Unpin,
{
    pg_row_get(row, col).map_err(|e| internal_db_error_response(context, e))
}

async fn healthz() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn status_common_fields(state: &AppState) -> (bool, Option<serde_json::Value>, Option<i64>) {
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

    (db_ok, chain_pointer, max_block)
}

fn rpc_metrics_json(state: &AppState) -> serde_json::Value {
    let rpc_snap = state.rpc_metrics.snapshot();
    json!({
        "total_calls": rpc_snap.total_calls,
        "calls_last_1m": rpc_snap.calls_last_1m,
        "calls_last_5m": rpc_snap.calls_last_5m,
        "calls_per_min_1m": rpc_snap.calls_per_min_1m,
        "calls_per_min_5m": rpc_snap.calls_per_min_5m,
        "peak_calls_10s": rpc_snap.peak_calls_10s,
        "by_method": rpc_snap.by_method,
        "by_caller": rpc_snap.by_caller,
        "by_method_caller": rpc_snap.by_method_caller,
    })
}

/// Public operator smoke surface — trimmed; detailed metrics on [`status_ops`] only.
async fn status(State(state): State<AppState>) -> Response {
    let (db_ok, _, max_block) = status_common_fields(&state).await;
    let body = json!({
        "schema_version": SCHEMA_VERSION,
        "database_connected": db_ok,
        "max_indexed_block": max_block,
        "ingestion_alive": state.ingestion_alive.load(Ordering::Acquire),
    });
    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

/// Detailed metrics for operators when `INDEXER_EXPOSE_OPS_METRICS=1`.
async fn status_ops(State(state): State<AppState>) -> Response {
    if !expose_ops_metrics() {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({ "error": "not found" })),
        )
            .into_response();
    }
    let (db_ok, chain_pointer, max_block) = status_common_fields(&state).await;
    let body = json!({
        "schema_version": SCHEMA_VERSION,
        "database_connected": db_ok,
        "chain_pointer": chain_pointer,
        "max_indexed_block": max_block,
        "ingestion_alive": state.ingestion_alive.load(Ordering::Acquire),
        "last_indexed_at_ms": state.last_indexed_at_ms.load(Ordering::Acquire),
        "rpc_metrics": rpc_metrics_json(&state),
    });
    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Debug, serde::Deserialize)]
struct ReferralRegistrationsQuery {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    pub owner: Option<String>,
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
    Query(p): Query<ReferralRegistrationsQuery>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    if let Some(ref addr) = p.owner {
        if !valid_0x_address20(addr) {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "owner must be a 0x-prefixed 20-byte address" })),
            )
                .into_response();
        }
    }

    let rows = if let Some(ref addr) = p.owner {
        let addr_l = addr.to_ascii_lowercase();
        sqlx::query(
            r#"SELECT block_number, tx_hash, log_index, owner_address, code_hash, normalized_code
               FROM idx_referral_code_registered
               WHERE owner_address = $3
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
            r#"SELECT block_number, tx_hash, log_index, owner_address, code_hash, normalized_code
               FROM idx_referral_code_registered
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
        Err(e) => return internal_db_error_response("GET /v1/referrals/registrations", e),
    };

    let mut items = Vec::with_capacity(rows.len());
    for r in rows {
        items.push(ReferralRegistrationRow {
            block_number: match pg_row_required::<i64>(&r, "block_number", "GET /v1/referrals/registrations") {
                Ok(v) => v.to_string(),
                Err(res) => return res,
            },
            tx_hash: match pg_row_required(&r, "tx_hash", "GET /v1/referrals/registrations") {
                Ok(v) => v,
                Err(res) => return res,
            },
            log_index: match pg_row_required(&r, "log_index", "GET /v1/referrals/registrations") {
                Ok(v) => v,
                Err(res) => return res,
            },
            owner_address: match pg_row_required(&r, "owner_address", "GET /v1/referrals/registrations") {
                Ok(v) => v,
                Err(res) => return res,
            },
            code_hash: match pg_row_required(&r, "code_hash", "GET /v1/referrals/registrations") {
                Ok(v) => v,
                Err(res) => return res,
            },
            normalized_code: match pg_row_required(&r, "normalized_code", "GET /v1/referrals/registrations") {
                Ok(v) => v,
                Err(res) => return res,
            },
        });
    }

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let mut res = Json(json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    }))
    .into_response();
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
struct ReferralAppliedRow {
    block_number: String,
    tx_hash: String,
    log_index: i32,
    buyer: String,
    referrer: String,
    code_hash: String,
    referrer_cred: String,
    buyer_cred: String,
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
                      referrer_cred::text AS referrer_cred,
                      buyer_cred::text AS buyer_cred
               FROM idx_arena_referral_cred
               WHERE referrer = $3
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
                      referrer_cred::text AS referrer_cred,
                      buyer_cred::text AS buyer_cred
               FROM idx_arena_referral_cred
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
        Err(e) => return internal_db_error_response("GET /v1/referrals/applied", e),
    };

    let mut items = Vec::with_capacity(rows.len());
    for r in rows {
        items.push(ReferralAppliedRow {
            block_number: match pg_row_required::<i64>(&r, "block_number", "GET /v1/referrals/applied") {
                Ok(v) => v.to_string(),
                Err(res) => return res,
            },
            tx_hash: match pg_row_required(&r, "tx_hash", "GET /v1/referrals/applied") {
                Ok(v) => v,
                Err(res) => return res,
            },
            log_index: match pg_row_required(&r, "log_index", "GET /v1/referrals/applied") {
                Ok(v) => v,
                Err(res) => return res,
            },
            buyer: match pg_row_required(&r, "buyer", "GET /v1/referrals/applied") {
                Ok(v) => v,
                Err(res) => return res,
            },
            referrer: match pg_row_required(&r, "referrer", "GET /v1/referrals/applied") {
                Ok(v) => v,
                Err(res) => return res,
            },
            code_hash: match pg_row_required(&r, "code_hash", "GET /v1/referrals/applied") {
                Ok(v) => v,
                Err(res) => return res,
            },
            referrer_cred: match pg_row_required(&r, "referrer_cred", "GET /v1/referrals/applied") {
                Ok(v) => v,
                Err(res) => return res,
            },
            buyer_cred: match pg_row_required(&r, "buyer_cred", "GET /v1/referrals/applied") {
                Ok(v) => v,
                Err(res) => return res,
            },
        });
    }

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let mut res = Json(json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
    }))
    .into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Serialize)]
struct ReferralReferrerLeaderboardRow {
    rank: i64,
    referrer: String,
    total_referrer_cred_wad: String,
    referred_buy_count: String,
    codes_registered_count: String,
}

async fn referral_referrer_leaderboard(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let totals = sqlx::query(
        r#"SELECT
              (SELECT COUNT(*)::bigint FROM idx_referral_code_registered) AS total_codes_registered,
              (SELECT COUNT(*)::bigint FROM idx_arena_referral_cred) AS total_referred_buys,
              (SELECT COALESCE(SUM(referrer_cred), 0)::text
                 FROM idx_arena_referral_cred) AS total_referrer_cred_wad,
              (SELECT COUNT(*)::bigint
                 FROM (
                        SELECT owner_address AS referrer FROM idx_referral_code_registered
                        UNION
                        SELECT referrer FROM idx_arena_referral_cred
                      ) u) AS total"#,
    )
    .fetch_one(&state.pool)
    .await;

    let totals = match totals {
        Ok(r) => r,
        Err(e) => {
            return internal_db_error_response("GET /v1/referrals/referrer-leaderboard totals", e);
        }
    };

    let total: i64 = totals.try_get::<i64, _>("total").unwrap_or(0);
    let total_codes_registered: i64 = totals
        .try_get::<i64, _>("total_codes_registered")
        .unwrap_or(0);
    let total_referred_buys: i64 = totals.try_get::<i64, _>("total_referred_buys").unwrap_or(0);
    let total_referrer_cred_wad: String = totals
        .try_get::<String, _>("total_referrer_cred_wad")
        .unwrap_or_else(|_| "0".into());

    let rows = sqlx::query(
        r#"SELECT referrer, total_referrer_cred_wad, referred_buy_count, codes_registered_count, rank
             FROM (
                 SELECT r.referrer,
                        COALESCE(a.total_cred, 0)::text AS total_referrer_cred_wad,
                        COALESCE(a.buy_count, 0)::text AS referred_buy_count,
                        COALESCE(reg.cnt, 0)::text AS codes_registered_count,
                        RANK() OVER (ORDER BY COALESCE(a.total_cred, 0) DESC NULLS LAST)::bigint AS rank
                   FROM (
                            SELECT owner_address AS referrer FROM idx_referral_code_registered
                            UNION
                            SELECT referrer FROM idx_arena_referral_cred
                        ) r
                   LEFT JOIN (
                            SELECT referrer, SUM(referrer_cred) AS total_cred,
                                   COUNT(*)::bigint AS buy_count
                              FROM idx_arena_referral_cred
                             GROUP BY referrer
                        ) a ON r.referrer = a.referrer
                   LEFT JOIN (
                            SELECT owner_address AS referrer, COUNT(*)::bigint AS cnt
                              FROM idx_referral_code_registered
                             GROUP BY owner_address
                        ) reg ON r.referrer = reg.referrer
             ) ranked
            ORDER BY rank ASC, referrer ASC
            LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let rows = match rows {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/referrals/referrer-leaderboard", e),
    };

    let mut items = Vec::with_capacity(rows.len());
    for r in rows {
        items.push(ReferralReferrerLeaderboardRow {
            rank: match pg_row_required(&r, "rank", "GET /v1/referrals/referrer-leaderboard") {
                Ok(v) => v,
                Err(res) => return res,
            },
            referrer: match pg_row_required(&r, "referrer", "GET /v1/referrals/referrer-leaderboard") {
                Ok(v) => v,
                Err(res) => return res,
            },
            total_referrer_cred_wad: match pg_row_required(
                &r,
                "total_referrer_cred_wad",
                "GET /v1/referrals/referrer-leaderboard",
            ) {
                Ok(v) => v,
                Err(res) => return res,
            },
            referred_buy_count: match pg_row_required(
                &r,
                "referred_buy_count",
                "GET /v1/referrals/referrer-leaderboard",
            ) {
                Ok(v) => v,
                Err(res) => return res,
            },
            codes_registered_count: match pg_row_required(
                &r,
                "codes_registered_count",
                "GET /v1/referrals/referrer-leaderboard",
            ) {
                Ok(v) => v,
                Err(res) => return res,
            },
        });
    }

    let next_offset = if items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let mut res = Json(json!({
        "items": items,
        "limit": lim,
        "offset": off,
        "next_offset": next_offset,
        "total": total,
        "total_codes_registered": total_codes_registered.to_string(),
        "total_referred_buys": total_referred_buys.to_string(),
        "total_referrer_cred_wad": total_referrer_cred_wad,
    }))
    .into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[derive(Debug, serde::Deserialize)]
pub struct ReferralWalletCredSummaryQuery {
    pub wallet: String,
}

async fn referral_wallet_cred_summary(
    State(state): State<AppState>,
    Query(q): Query<ReferralWalletCredSummaryQuery>,
) -> Response {
    if !valid_0x_address20(&q.wallet) {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "wallet must be a 0x-prefixed 20-byte address" })),
        )
            .into_response();
    }
    let w = q.wallet.to_lowercase();

    let row = sqlx::query(
        r#"SELECT
              (SELECT COALESCE(SUM(referrer_cred), 0)::text FROM idx_arena_referral_cred WHERE referrer = $1) AS referrer_cred_wad,
              (SELECT COALESCE(SUM(buyer_cred), 0)::text FROM idx_arena_referral_cred WHERE buyer = $1) AS buyer_cred_wad,
              (SELECT COUNT(*)::text FROM idx_arena_referral_cred WHERE referrer = $1) AS referred_buy_count,
              (SELECT COUNT(*)::text FROM idx_arena_referral_cred WHERE buyer = $1) AS referee_buy_count"#,
    )
    .bind(&w)
    .fetch_one(&state.pool)
    .await;

    let row = match row {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/referrals/wallet-cred-summary", e),
    };

    let mut res = Json(json!({
        "wallet": w,
        "referrer_cred_wad": row.try_get::<String, _>("referrer_cred_wad").unwrap_or_else(|_| "0".into()),
        "buyer_cred_wad": row.try_get::<String, _>("buyer_cred_wad").unwrap_or_else(|_| "0".into()),
        "referred_buy_count": row.try_get::<String, _>("referred_buy_count").unwrap_or_else(|_| "0".into()),
        "referee_buy_count": row.try_get::<String, _>("referee_buy_count").unwrap_or_else(|_| "0".into()),
    }))
    .into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[cfg(test)]
mod status_exposure_tests {
    use super::*;
    use axum::body::Body;
    use http_body_util::BodyExt;
    use serde_json::Value;
    use tower::ServiceExt;

    fn test_state() -> AppState {
        AppState {
            pool: sqlx::PgPool::connect_lazy("postgres://invalid").unwrap(),
            chain_timer: Arc::new(RwLock::new(None)),
            ingestion_alive: Arc::new(AtomicBool::new(true)),
            last_indexed_at_ms: Arc::new(AtomicU64::new(0)),
            rpc_metrics: RpcMetrics::default(),
        }
    }

    #[tokio::test]
    async fn public_status_omits_rpc_metrics_by_default() {
        std::env::remove_var("INDEXER_EXPOSE_OPS_METRICS");
        let app = router(test_state());
        let res = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/v1/status")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::OK);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let v: Value = serde_json::from_slice(&body).unwrap();
        assert!(v.get("rpc_metrics").is_none());
        assert!(v.get("chain_pointer").is_none());
        assert!(v.get("ingestion_alive").is_some());
    }

    #[tokio::test]
    async fn status_ops_not_found_without_flag() {
        std::env::remove_var("INDEXER_EXPOSE_OPS_METRICS");
        let app = router(test_state());
        let res = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/v1/status/ops")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::NOT_FOUND);
    }
}

#[cfg(test)]
mod internal_db_error_response_tests {
    use super::{internal_db_error_response, PUBLIC_INTERNAL_DB_ERROR};
    use axum::http::StatusCode;
    use http_body_util::BodyExt;
    use serde_json::Value;

    #[tokio::test]
    async fn internal_db_error_response_does_not_echo_sqlx_in_json_body() {
        let err = sqlx::Error::Protocol("idx_arena_buy relation does not exist".into());
        let res = internal_db_error_response("test_ctx", err);
        assert_eq!(res.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        let v: Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(v["error"].as_str().unwrap(), PUBLIC_INTERNAL_DB_ERROR);
    }
}


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

use crate::chain_timer::TimecurveHeadSnapshot;

const SCHEMA_VERSION: &str = "2.5.0";

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub chain_timer: Arc<RwLock<Option<TimecurveHeadSnapshot>>>,
    pub ingestion_alive: Arc<AtomicBool>,
    pub last_indexed_at_ms: Arc<AtomicU64>,
}

#[derive(Debug, serde::Deserialize)]
pub struct PageParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
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
        )
        .with_state(state)
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
        "ingestion_alive": state.ingestion_alive.load(Ordering::Acquire),
        "last_indexed_at_ms": state.last_indexed_at_ms.load(Ordering::Acquire),
    });

    let mut res = Json(body).into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

fn valid_0x_address20(s: &str) -> bool {
    s.starts_with("0x") && s.len() == 42 && s[2..].chars().all(|c| c.is_ascii_hexdigit())
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
                referrer_cred: r.try_get("referrer_cred").ok()?,
                buyer_cred: r.try_get("buyer_cred").ok()?,
            })
        })
        .collect();

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

    let items: Vec<ReferralReferrerLeaderboardRow> = rows
        .into_iter()
        .filter_map(|r| {
            Some(ReferralReferrerLeaderboardRow {
                rank: r.try_get("rank").ok()?,
                referrer: r.try_get("referrer").ok()?,
                total_referrer_cred_wad: r.try_get("total_referrer_cred_wad").ok()?,
                referred_buy_count: r.try_get("referred_buy_count").ok()?,
                codes_registered_count: r.try_get("codes_registered_count").ok()?,
            })
        })
        .collect();

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

#[cfg(test)]
mod address_validation_tests {
    use super::valid_0x_address20;

    #[test]
    fn valid_0x_address20_accepts_20_byte_hex() {
        assert!(valid_0x_address20(
            "0xdddddddddddddddddddddddddddddddddddddddd"
        ));
    }

    #[test]
    fn valid_0x_address20_rejects_invalid() {
        assert!(!valid_0x_address20("0xbad"));
        assert!(!valid_0x_address20("not-an-address"));
    }
}

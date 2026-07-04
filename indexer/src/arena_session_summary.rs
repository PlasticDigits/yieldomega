// SPDX-License-Identifier: AGPL-3.0-or-later

//! `GET /v1/arena/session-summary` — per-browser absent-session aggregates ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338)).

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use alloy_primitives::U256;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::api::{internal_db_error_response, with_schema_version, AppState};
use crate::api_validate::valid_0x_address20;
use crate::arena_podium_live::podium_label_for_onchain_category;
use crate::arena_podium_prize::payout_shares;

/// Maximum lookback for `since_ms` (30 days).
pub const MAX_SINCE_AGE_MS: i64 = 30 * 24 * 60 * 60 * 1000;
/// Clock skew tolerance when `since_ms` is slightly ahead of server time.
pub const FUTURE_SINCE_TOLERANCE_MS: i64 = 60_000;
/// Cap podium epoch rows in the response.
pub const MAX_PODIUM_EPOCHS: i64 = 20;

#[derive(Debug, serde::Deserialize)]
pub struct SessionSummaryParams {
    pub since_ms: i64,
    pub wallet: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SinceClampError {
    FutureSince,
}

/// Validates and clamps `since_ms` to `[now - 30d, now + tolerance]`.
pub fn clamp_since_ms(since_ms: i64, now_ms: i64) -> Result<i64, SinceClampError> {
    if since_ms > now_ms + FUTURE_SINCE_TOLERANCE_MS {
        return Err(SinceClampError::FutureSince);
    }
    let min_since = now_ms.saturating_sub(MAX_SINCE_AGE_MS);
    Ok(since_ms.max(min_since))
}

pub async fn arena_session_summary(
    State(state): State<AppState>,
    Query(params): Query<SessionSummaryParams>,
) -> Response {
    let now_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0);
    let since_ms = match clamp_since_ms(params.since_ms, now_ms) {
        Ok(v) => v,
        Err(SinceClampError::FutureSince) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "since_ms_in_future" })),
            )
                .into_response();
        }
    };

    let wallet = match params.wallet.as_deref() {
        None => None,
        Some(raw) => {
            let w = raw.trim().to_ascii_lowercase();
            if !valid_0x_address20(&w) {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "invalid_address" })),
                )
                    .into_response();
            }
            Some(w)
        }
    };

    let body = match fetch_session_summary(&state.pool, since_ms, now_ms, wallet.as_deref()).await {
        Ok(v) => v,
        Err(e) => return internal_db_error_response("GET /v1/arena/session-summary", e),
    };

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(body),
    )
        .into_response()
}

pub async fn fetch_session_summary(
    pool: &PgPool,
    since_ms: i64,
    now_ms: i64,
    wallet: Option<&str>,
) -> Result<Value, sqlx::Error> {
    let since_sec = since_ms as f64 / 1000.0;
    let elapsed_ms = (now_ms - since_ms).max(0);

    let summary_row = sqlx::query(
        r#"SELECT
              (SELECT COUNT(*)::bigint FROM idx_arena_buy
                WHERE block_timestamp >= to_timestamp($1)) AS total_buys,
              (SELECT COUNT(DISTINCT buyer)::bigint FROM idx_arena_buy
                WHERE block_timestamp >= to_timestamp($1)) AS unique_players,
              (SELECT COUNT(*)::bigint FROM idx_arena_podium_epoch
                WHERE block_timestamp >= to_timestamp($1)) AS podium_updates"#,
    )
    .bind(since_sec)
    .fetch_one(pool)
    .await?;

    let total_buys: i64 = summary_row.try_get("total_buys").unwrap_or(0);
    let unique_players: i64 = summary_row.try_get("unique_players").unwrap_or(0);
    let podium_updates: i64 = summary_row.try_get("podium_updates").unwrap_or(0);

    let podium_epochs = fetch_podium_epochs_ended(pool, since_sec).await?;

    let wallet_summary = match wallet {
        Some(w) => Some(fetch_wallet_summary(pool, since_sec, w).await?),
        None => None,
    };

    Ok(json!({
        "since_ms": since_ms.to_string(),
        "elapsed_ms": elapsed_ms.to_string(),
        "total_buys": total_buys.to_string(),
        "unique_players": unique_players.to_string(),
        "podium_updates": podium_updates.to_string(),
        "podium_epochs_ended": podium_epochs,
        "wallet_summary": wallet_summary,
    }))
}

async fn fetch_podium_epochs_ended(pool: &PgPool, since_sec: f64) -> Result<Vec<Value>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT category, epoch::text, first_place, second_place, third_place,
                  pool_paid::text AS pool_paid
           FROM idx_arena_podium_epoch
           WHERE block_timestamp >= to_timestamp($1)
           ORDER BY block_timestamp DESC NULLS LAST, block_number DESC, log_index DESC
           LIMIT $2"#,
    )
    .bind(since_sec)
    .bind(MAX_PODIUM_EPOCHS)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| {
            let category: i16 = r.get("category");
            let label = podium_label_for_onchain_category(category as u8);
            let pool_paid: String = r.get("pool_paid");
            let pool = U256::from_str_radix(pool_paid.as_str(), 10).unwrap_or(U256::ZERO);
            let (first_prize, second_prize, third_prize) = payout_shares(pool);
            let first_place: Option<String> = r.try_get("first_place").ok();
            let second_place: Option<String> = r.try_get("second_place").ok();
            let third_place: Option<String> = r.try_get("third_place").ok();
            json!({
                "podium": label,
                "category": category,
                "epoch": r.get::<String, _>("epoch"),
                "winners": [
                    { "rank": 1, "address": first_place, "prize_doub_wad": first_prize.to_string() },
                    { "rank": 2, "address": second_place, "prize_doub_wad": second_prize.to_string() },
                    { "rank": 3, "address": third_place, "prize_doub_wad": third_prize.to_string() },
                ],
                "pool_paid_doub_wad": pool_paid,
            })
        })
        .collect())
}

async fn fetch_wallet_summary(
    pool: &PgPool,
    since_sec: f64,
    wallet: &str,
) -> Result<Value, sqlx::Error> {
    let buy_count: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM idx_arena_buy
           WHERE buyer = $1 AND block_timestamp >= to_timestamp($2)"#,
    )
    .bind(wallet)
    .bind(since_sec)
    .fetch_one(pool)
    .await?;

    let wins: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM idx_arena_podium_epoch
           WHERE block_timestamp >= to_timestamp($1)
             AND (first_place = $2 OR second_place = $2 OR third_place = $2)"#,
    )
    .bind(since_sec)
    .bind(wallet)
    .fetch_one(pool)
    .await?;

    let rank_now = buyer_rank_by_doub_spent(pool, wallet, None).await?;
    let rank_at_since = buyer_rank_by_doub_spent(pool, wallet, Some(since_sec)).await?;

    let rank_delta = match (rank_at_since, rank_now) {
        (Some(before), Some(after)) => Some(before - after),
        _ => None,
    };

    Ok(json!({
        "address": wallet,
        "buy_count": buy_count.to_string(),
        "wins": wins.to_string(),
        "rank_at_since": rank_at_since.map(|r| r.to_string()),
        "rank_now": rank_now.map(|r| r.to_string()),
        "rank_delta": rank_delta.map(|d| d.to_string()),
    }))
}

async fn buyer_rank_by_doub_spent(
    pool: &PgPool,
    wallet: &str,
    before_sec: Option<f64>,
) -> Result<Option<i64>, sqlx::Error> {
    let row = sqlx::query(
        r#"WITH totals AS (
              SELECT buyer, COALESCE(SUM(doub_paid), 0) AS total
                FROM idx_arena_buy
               WHERE ($1::float8 IS NULL OR block_timestamp < to_timestamp($1))
               GROUP BY buyer
           ),
           ranked AS (
              SELECT buyer,
                     RANK() OVER (ORDER BY total DESC, buyer ASC)::bigint AS rank
                FROM totals
           )
           SELECT rank FROM ranked WHERE buyer = $2"#,
    )
    .bind(before_sec)
    .bind(wallet)
    .fetch_optional(pool)
    .await?;

    Ok(row.and_then(|r| r.try_get("rank").ok()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn clamp_since_ms_rejects_far_future() {
        let now = 1_700_000_000_000i64;
        assert_eq!(
            clamp_since_ms(now + FUTURE_SINCE_TOLERANCE_MS + 1, now),
            Err(SinceClampError::FutureSince)
        );
    }

    #[test]
    fn clamp_since_ms_allows_small_future_skew() {
        let now = 1_700_000_000_000i64;
        assert_eq!(
            clamp_since_ms(now + FUTURE_SINCE_TOLERANCE_MS, now),
            Ok(now + FUTURE_SINCE_TOLERANCE_MS)
        );
    }

    #[test]
    fn clamp_since_ms_floors_to_thirty_day_window() {
        let now = 1_700_000_000_000i64;
        let old = now - MAX_SINCE_AGE_MS - 1_000;
        assert_eq!(clamp_since_ms(old, now), Ok(now - MAX_SINCE_AGE_MS));
    }

    #[test]
    fn podium_label_maps_onchain_category_not_ux_index() {
        use crate::arena_podium_live::podium_label_for_onchain_category;

        assert_eq!(podium_label_for_onchain_category(0), "last_buy");
        assert_eq!(podium_label_for_onchain_category(1), "time_booster");
        assert_eq!(podium_label_for_onchain_category(2), "defended_streak");
        assert_eq!(podium_label_for_onchain_category(3), "warbow");
    }
}

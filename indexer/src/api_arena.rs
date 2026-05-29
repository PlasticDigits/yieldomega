// SPDX-License-Identifier: AGPL-3.0-or-later

//! `GET /v1/arena/*` — Arena v2 read API (#254, #255).

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use sqlx::Row;

use crate::api::{internal_db_error_response, with_schema_version, AppState, PageParams};

pub fn arena_routes() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/v1/arena/timers", axum::routing::get(arena_timers))
        .route("/v1/arena/podiums", axum::routing::get(arena_podiums))
        .route("/v1/arena/buys", axum::routing::get(arena_buys))
        .route(
            "/v1/arena/wallet/{address}/stats",
            axum::routing::get(arena_wallet_stats),
        )
        .route(
            "/v1/arena/podium-pool-donations",
            axum::routing::get(arena_podium_pool_donations),
        )
}

#[derive(Debug, serde::Deserialize)]
struct PodiumPoolDonationsQuery {
    #[serde(default = "default_donate_recent_limit")]
    limit: i64,
    donor: Option<String>,
}

fn default_donate_recent_limit() -> i64 {
    10
}

async fn arena_podium_pool_donations(
    State(state): State<AppState>,
    Query(p): Query<PodiumPoolDonationsQuery>,
) -> Response {
    let limit = p.limit.clamp(1, 100);

    let totals = match sqlx::query(
        r#"SELECT COALESCE(SUM(amount_doub_wad), 0)::text AS total,
                  COUNT(DISTINCT donor_address)::bigint AS unique_donors
           FROM idx_arena_podium_pool_top_up"#,
    )
    .fetch_one(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/podium-pool-donations", e),
    };

    let recent_rows = match sqlx::query(
        r#"SELECT donor_address, amount_doub_wad::text AS amount,
                  EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec,
                  tx_hash
           FROM idx_arena_podium_pool_top_up
           ORDER BY block_timestamp DESC NULLS LAST, block_number DESC, log_index DESC
           LIMIT $1"#,
    )
    .bind(limit)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/podium-pool-donations", e),
    };

    let recent: Vec<_> = recent_rows
        .iter()
        .map(|r| {
            json!({
                "donor": r.get::<String, _>("donor_address"),
                "amount_doub_wad": r.get::<String, _>("amount"),
                "block_timestamp": r.get::<Option<String>, _>("block_timestamp_sec"),
                "tx_hash": r.get::<String, _>("tx_hash"),
            })
        })
        .collect();

    let mut body = json!({
        "total_donated_doub_wad": totals.get::<String, _>("total"),
        "unique_donors_count": totals.get::<i64, _>("unique_donors").to_string(),
        "recent": recent,
    });

    if let Some(donor) = p.donor.as_deref() {
        let w = donor.trim().to_ascii_lowercase();
        if !w.starts_with("0x") || w.len() != 42 {
            return (StatusCode::BAD_REQUEST, Json(json!({ "error": "invalid_address" }))).into_response();
        }
        let donor_row = match sqlx::query(
            r#"SELECT COALESCE(SUM(amount_doub_wad), 0)::text AS total,
                      COUNT(*)::bigint AS donation_count
               FROM idx_arena_podium_pool_top_up
               WHERE donor_address = $1"#,
        )
        .bind(&w)
        .fetch_one(&state.pool)
        .await
        {
            Ok(r) => r,
            Err(e) => return internal_db_error_response("GET /v1/arena/podium-pool-donations", e),
        };
        body["donor_summary"] = json!({
            "total_donated_doub_wad": donor_row.get::<String, _>("total"),
            "donation_count": donor_row.get::<i64, _>("donation_count").to_string(),
        });
    }

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(body),
    )
        .into_response()
}

async fn arena_timers(State(state): State<AppState>) -> Response {
    let head = state.chain_timer.read().await;
    let Some(h) = head.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "chain_timer_unavailable" })),
        )
            .into_response();
    };
    let body = json!({
        "read_block_number": h.timer.read_block_number,
        "block_timestamp_sec": h.timer.block_timestamp_sec,
        "last_buy_deadline_sec": h.timer.deadline_sec,
        "timer_cap_sec": h.timer.timer_cap_sec,
        "arena_start_sec": h.timer.sale_start_sec,
        "paused": h.sale_state.paused,
        "total_doub_raised": h.sale_state.total_doub_raised,
        "last_buy_epoch": h.timer.last_buy_epoch,
        "podium_deadlines_sec": h.timer.podium_deadlines_sec,
    });
    (StatusCode::OK, with_schema_version(axum::http::HeaderMap::new()), Json(body)).into_response()
}

async fn arena_podiums(State(state): State<AppState>) -> Response {
    let head = state.chain_timer.read().await;
    let Some(h) = head.as_ref() else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "error": "chain_timer_unavailable" })),
        )
            .into_response();
    };
    let labels = ["last_buy", "time_booster", "defended_streak", "warbow"];
    let rows: Vec<_> = h
        .podium_contract
        .iter()
        .enumerate()
        .map(|(i, p)| {
            json!({
                "category": labels.get(i).unwrap_or(&"unknown"),
                "winners": p.winners,
                "values": p.values,
                "podium_prediction": true,
            })
        })
        .collect();
    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({ "rows": rows, "read_block_number": h.timer.read_block_number })),
    )
        .into_response()
}

async fn arena_buys(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let limit = p.limit.clamp(1, 200);
    let offset = p.offset.max(0);
    let rows = match sqlx::query(
        r#"SELECT buyer, charm_wad::text, doub_paid::text, block_number, tx_hash,
                  timer_hard_reset, paid_with_cred
           FROM idx_arena_buy
           ORDER BY block_number DESC, log_index DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/buys", e),
    };
    let items: Vec<_> = rows
        .iter()
        .map(|r| {
            json!({
                "buyer": r.get::<String, _>("buyer"),
                "charm_wad": r.get::<String, _>("charm_wad"),
                "doub_paid": r.get::<String, _>("doub_paid"),
                "block_number": r.get::<i64, _>("block_number"),
                "tx_hash": r.get::<String, _>("tx_hash"),
                "timer_hard_reset": r.get::<bool, _>("timer_hard_reset"),
                "paid_with_cred": r.get::<bool, _>("paid_with_cred"),
            })
        })
        .collect();
    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({ "items": items, "limit": limit, "offset": offset })),
    )
        .into_response()
}

async fn arena_wallet_stats(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Response {
    let w = address.trim().to_ascii_lowercase();
    if !w.starts_with("0x") || w.len() != 42 {
        return (StatusCode::BAD_REQUEST, Json(json!({ "error": "invalid_address" }))).into_response();
    }

    let buy_row = sqlx::query(
        r#"SELECT COUNT(*)::bigint AS buy_count,
                  COALESCE(SUM(doub_paid), 0)::text AS total_spent,
                  COALESCE(AVG(doub_paid), 0)::text AS avg_buy,
                  COALESCE(MAX(doub_paid), 0)::text AS max_buy,
                  MIN(EXTRACT(EPOCH FROM block_timestamp))::text AS first_buy_sec
           FROM idx_arena_buy WHERE lower(buyer) = $1"#,
    )
    .bind(&w)
    .fetch_optional(&state.pool)
    .await;

    let xp_row = sqlx::query(
        r#"SELECT new_level::text FROM idx_player_xp
           WHERE lower(player) = $1 ORDER BY block_number DESC LIMIT 1"#,
    )
    .bind(&w)
    .fetch_optional(&state.pool)
    .await;

    let cred_row = sqlx::query(
        r#"SELECT COALESCE(SUM(amount), 0)::text AS claimed
           FROM idx_play_cred_claim WHERE lower(claimer) = $1"#,
    )
    .bind(&w)
    .fetch_optional(&state.pool)
    .await;

    let steals_row = sqlx::query(
        r#"SELECT COUNT(*)::bigint AS cnt FROM idx_arena_warbow_steal WHERE lower(attacker) = $1"#,
    )
    .bind(&w)
    .fetch_optional(&state.pool)
    .await;

    let (buy_count, total_spent, avg_buy, max_buy, first_buy_sec): (i64, String, String, String, Option<String>) =
        match buy_row {
            Ok(Some(r)) => (
                r.get("buy_count"),
                r.get("total_spent"),
                r.get("avg_buy"),
                r.get("max_buy"),
                r.try_get("first_buy_sec").ok(),
            ),
            Ok(None) => (0, "0".into(), "0".into(), "0".into(), None),
            Err(e) => return internal_db_error_response("GET /v1/arena/wallet/stats", e),
        };

    let level = xp_row
        .ok()
        .flatten()
        .map(|r| r.get::<String, _>("new_level"))
        .unwrap_or_else(|| "1".into());
    let cred_claimed = cred_row
        .ok()
        .flatten()
        .map(|r| r.get::<String, _>("claimed"))
        .unwrap_or_else(|| "0".into());
    let warbow_steals = steals_row
        .ok()
        .flatten()
        .map(|r| r.get::<i64, _>("cnt"))
        .unwrap_or(0);

    let body = json!({
        "address": w,
        "epochs_participated": std::cmp::min(buy_count, 1_i64),
        "buy_count": buy_count,
        "total_spent_doub": total_spent,
        "average_buy_doub": avg_buy,
        "max_single_buy_doub": max_buy,
        "first_buy_at": first_buy_sec,
        "xp": "0",
        "level": level,
        "prizes_won": [],
        "total_won_doub": "0",
        "highest_scores": [],
        "warbow_steals": warbow_steals,
        "cred_claimed": cred_claimed,
        "referral_cred_earned": "0",
    });
    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(body),
    )
        .into_response()
}

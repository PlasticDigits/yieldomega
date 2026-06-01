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
use crate::arena_wallet_stats;

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
        .route(
            "/v1/arena/vault-funding/recent",
            axum::routing::get(arena_vault_funding_recent),
        )
        .route(
            "/v1/arena/vault-funding/by-tx/{tx_hash}",
            axum::routing::get(arena_vault_funding_by_tx),
        )
        .route(
            "/v1/arena/vault-funding/totals",
            axum::routing::get(arena_vault_funding_totals),
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

    let body = match arena_wallet_stats::fetch_wallet_stats(&state.pool, &w).await {
        Ok(body) => body,
        Err(e) => return internal_db_error_response("GET /v1/arena/wallet/stats", e),
    };
    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(body),
    )
        .into_response()
}

fn normalize_tx_hash_param(raw: &str) -> Option<String> {
    let h = raw.trim().to_ascii_lowercase();
    if !h.starts_with("0x") || h.len() != 66 || !h[2..].chars().all(|c| c.is_ascii_hexdigit()) {
        return None;
    }
    Some(h)
}

#[derive(Debug, serde::Deserialize)]
struct VaultFundingRecentQuery {
    #[serde(flatten)]
    page: PageParams,
}

async fn arena_vault_funding_recent(
    State(state): State<AppState>,
    Query(p): Query<VaultFundingRecentQuery>,
) -> Response {
    let limit = p.page.limit.clamp(1, 200);
    let offset = p.page.offset.max(0);

    let rows = match sqlx::query(
        r#"SELECT kind, podium_id, amount_doub_wad::text AS amount,
                  pool_address, block_number, tx_hash,
                  EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec
           FROM idx_arena_vault_funding
           ORDER BY block_number DESC, log_index DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit)
    .bind(offset)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/vault-funding/recent", e),
    };

    let items: Vec<_> = rows
        .iter()
        .map(|r| {
            json!({
                "kind": r.get::<String, _>("kind"),
                "podium_id": r.get::<Option<i16>, _>("podium_id").map(|p| p.to_string()),
                "amount_doub_wad": r.get::<String, _>("amount"),
                "pool_address": r.get::<Option<String>, _>("pool_address"),
                "block_number": r.get::<i64, _>("block_number"),
                "block_timestamp": r.get::<Option<String>, _>("block_timestamp_sec"),
                "tx_hash": r.get::<String, _>("tx_hash"),
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

async fn arena_vault_funding_by_tx(
    State(state): State<AppState>,
    Path(tx_hash): Path<String>,
) -> Response {
    let Some(tx_h) = normalize_tx_hash_param(&tx_hash) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid_tx_hash" })),
        )
            .into_response();
    };

    let rows = match sqlx::query(
        r#"SELECT kind, podium_id, amount_doub_wad::text AS amount, pool_address, log_index
           FROM idx_arena_vault_funding
           WHERE tx_hash = $1
           ORDER BY log_index ASC"#,
    )
    .bind(&tx_h)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/vault-funding/by-tx", e),
    };

    let total_row = match sqlx::query(
        r#"SELECT COALESCE(SUM(amount_doub_wad), 0)::text AS total
           FROM idx_arena_vault_funding WHERE tx_hash = $1"#,
    )
    .bind(&tx_h)
    .fetch_one(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/vault-funding/by-tx", e),
    };

    let items: Vec<_> = rows
        .iter()
        .map(|r| {
            json!({
                "kind": r.get::<String, _>("kind"),
                "podium_id": r.get::<Option<i16>, _>("podium_id").map(|p| p.to_string()),
                "amount_doub_wad": r.get::<String, _>("amount"),
                "pool_address": r.get::<Option<String>, _>("pool_address"),
                "log_index": r.get::<i32, _>("log_index"),
            })
        })
        .collect();

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({
            "tx_hash": tx_h,
            "items": items,
            "total_funded_doub_wad": total_row.get::<String, _>("total"),
        })),
    )
        .into_response()
}

async fn arena_vault_funding_totals(State(state): State<AppState>) -> Response {
    let rows = match sqlx::query(
        r#"SELECT kind, podium_id, COALESCE(SUM(amount_doub_wad), 0)::text AS total
           FROM idx_arena_vault_funding
           GROUP BY kind, podium_id
           ORDER BY kind, podium_id NULLS FIRST"#,
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/vault-funding/totals", e),
    };

    let by_kind = match sqlx::query(
        r#"SELECT kind, COALESCE(SUM(amount_doub_wad), 0)::text AS total
           FROM idx_arena_vault_funding
           GROUP BY kind
           ORDER BY kind"#,
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/vault-funding/totals", e),
    };

    let kind_totals: Vec<_> = by_kind
        .iter()
        .map(|r| {
            json!({
                "kind": r.get::<String, _>("kind"),
                "total_doub_wad": r.get::<String, _>("total"),
            })
        })
        .collect();

    let by_podium: Vec<_> = rows
        .iter()
        .filter(|r| r.get::<Option<i16>, _>("podium_id").is_some())
        .map(|r| {
            json!({
                "kind": r.get::<String, _>("kind"),
                "podium_id": r.get::<Option<i16>, _>("podium_id").map(|p| p.to_string()),
                "total_doub_wad": r.get::<String, _>("total"),
            })
        })
        .collect();

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({
            "by_kind": kind_totals,
            "by_kind_and_podium": by_podium,
        })),
    )
        .into_response()
}

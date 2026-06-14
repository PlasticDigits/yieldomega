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
use crate::api_pagination::{encode_cursor, parse_cursor};
use crate::arena_platform_usage::arena_platform_usage;
use crate::arena_podium_live::{
    fetch_live_podium_conn, last_buy_winner_buy_sec_pool, live_row_has_entrant,
    warbow_top3_from_scores_conn, LivePodiumRow, PODIUM_CATEGORY_LABELS, PODIUM_UX_CATEGORY_ORDER,
};
use crate::arena_podium_prize;
use crate::arena_wallet_stats;

pub fn arena_routes() -> axum::Router<AppState> {
    axum::Router::new()
        .route("/v1/arena/timers", axum::routing::get(arena_timers))
        .route(
            "/v1/arena/last-buy-epoch-pricing",
            axum::routing::get(arena_last_buy_epoch_pricing),
        )
        .route("/v1/arena/podiums", axum::routing::get(arena_podiums))
        .route("/v1/arena/buys", axum::routing::get(arena_buys))
        .route("/v1/arena/activity", axum::routing::get(arena_activity))
        .route(
            "/v1/arena/platform-usage",
            axum::routing::get(arena_platform_usage),
        )
        .route(
            "/v1/arena/wallet/{address}/stats",
            axum::routing::get(arena_wallet_stats),
        )
        .route(
            "/v1/arena/warbow/latest-bp",
            axum::routing::get(arena_warbow_latest_bp),
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
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid_address" })),
            )
                .into_response();
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
        "podium_epochs": h.timer.podium_epochs,
        "podium_deadlines_sec": h.timer.podium_deadlines_sec,
        "charm_price_wad": h.sale_head.charm_price_wad,
        "epoch_charm_anchor_wad": h.sale_head.epoch_charm_anchor_wad,
        "epoch_anchor_timestamp_sec": h.sale_head.epoch_anchor_timestamp_sec,
        "doub": h.sale_head.doub,
        "referral_registry": h.sale_head.referral_registry,
        "buy_cooldown_sec": h.sale_head.buy_cooldown_sec,
        "timer_extension_sec": h.sale_head.timer_extension_sec,
        "time_arena_buy_router": h.sale_head.time_arena_buy_router,
        "referral_cred_flat_wad": h.sale_head.referral_cred_flat_wad,
    });
    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(body),
    )
        .into_response()
}

async fn arena_last_buy_epoch_pricing(State(state): State<AppState>) -> Response {
    let rows = match sqlx::query(
        r#"SELECT epoch::text,
                  MAX(anchor_charm_price_wad)::text AS anchor_charm_price_wad,
                  MAX(doub_usd_wad)::text AS doub_usd_wad,
                  MAX(anchor_timestamp_sec)::text AS anchor_timestamp_sec,
                  MAX(deadline)::text AS deadline,
                  MAX(block_number)::text AS block_number,
                  (array_agg(tx_hash ORDER BY log_index))[1] AS tx_hash
           FROM idx_arena_last_buy_epoch_started
           GROUP BY epoch
           ORDER BY epoch DESC
           LIMIT 200"#,
    )
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/last-buy-epoch-pricing", e),
    };

    let epochs: Vec<serde_json::Value> = rows
        .iter()
        .map(|r| {
            json!({
                "epoch": r.get::<String, _>("epoch"),
                "anchor_charm_price_wad": r.get::<Option<String>, _>("anchor_charm_price_wad"),
                "doub_usd_wad": r.get::<Option<String>, _>("doub_usd_wad"),
                "anchor_timestamp_sec": r.get::<Option<String>, _>("anchor_timestamp_sec"),
                "deadline_sec": r.get::<Option<String>, _>("deadline"),
                "block_number": r.get::<Option<String>, _>("block_number"),
                "tx_hash": r.get::<Option<String>, _>("tx_hash"),
            })
        })
        .collect();

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({ "epochs": epochs })),
    )
        .into_response()
}

fn epoch_for_category(head: &crate::chain_timer::TimecurveHeadSnapshot, cat: u8) -> String {
    if cat == 0 {
        head.timer.last_buy_epoch.clone()
    } else {
        head.timer.podium_epochs[cat as usize].clone()
    }
}

async fn fetch_live_podium_pool(
    pool: &sqlx::PgPool,
    category: u8,
    epoch: &str,
) -> Result<Option<LivePodiumRow>, sqlx::Error> {
    let mut conn = pool.acquire().await?;
    fetch_live_podium_conn(&mut conn, category, epoch).await
}

async fn warbow_top3_from_scores_pool(
    pool: &sqlx::PgPool,
    epoch: &str,
) -> Result<LivePodiumRow, sqlx::Error> {
    let mut conn = pool.acquire().await?;
    warbow_top3_from_scores_conn(&mut conn, epoch).await
}

fn live_to_json(row: &LivePodiumRow) -> (Vec<String>, Vec<String>) {
    (row.winners.to_vec(), row.values.to_vec())
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

    let mut rows: Vec<serde_json::Value> = Vec::with_capacity(4);
    for (ux_i, &cat) in PODIUM_UX_CATEGORY_ORDER.iter().enumerate() {
        let epoch = epoch_for_category(h, cat);
        let label = PODIUM_CATEGORY_LABELS[ux_i];

        let mut live = match fetch_live_podium_pool(&state.pool, cat, &epoch).await {
            Ok(v) => v,
            Err(e) => return internal_db_error_response("GET /v1/arena/podiums", e),
        };

        if cat == 3 {
            let needs_warbow_scores = live
                .as_ref()
                .map(|r| !live_row_has_entrant(r))
                .unwrap_or(true);
            if needs_warbow_scores {
                match warbow_top3_from_scores_pool(&state.pool, &epoch).await {
                    Ok(wb) if live_row_has_entrant(&wb) => live = Some(wb),
                    Ok(_) => {}
                    Err(e) => return internal_db_error_response("GET /v1/arena/podiums", e),
                }
            }
        }

        let (winners, values, podium_prediction) = if let Some(ref r) = live {
            let (w, v) = live_to_json(r);
            (w, v, live_row_has_entrant(r))
        } else {
            let rpc = &h.podium_contract[cat as usize];
            (rpc.winners.to_vec(), rpc.values.to_vec(), false)
        };

        let pool_wad = h.active_pool_balance_doub_wad[cat as usize].clone();
        let pool_u256 = pool_wad.parse::<alloy_primitives::U256>().unwrap_or_default();
        let prize_places = arena_podium_prize::prize_places_wad_strings(pool_u256);

        let mut row = json!({
            "category": label,
            "category_index": cat,
            "epoch": epoch,
            "winners": winners,
            "values": values,
            "podium_prediction": podium_prediction,
            "active_pool_balance_doub_wad": pool_wad,
            "prize_places_doub_wad": prize_places,
        });
        if cat == 0 {
            row["last_buy_prediction"] = json!(podium_prediction);
            match last_buy_winner_buy_sec_pool(&state.pool, &epoch).await {
                Ok(secs) => {
                    row["winner_buy_sec"] = json!(secs);
                }
                Err(e) => return internal_db_error_response("GET /v1/arena/podiums", e),
            }
        }
        rows.push(row);
    }

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({
            "rows": rows,
            "read_block_number": h.timer.read_block_number,
            "sale_ended": h.sale_ended,
        })),
    )
        .into_response()
}

/// Maps `TimeArenaBuyRouter` `PAY_ETH` / `PAY_STABLE` / `PAY_CL8Y` for API consumers (GitLab #67, #319).
fn kumbaya_entry_pay_asset(pay_kind: Option<i16>) -> Option<String> {
    match pay_kind? {
        0 => Some("eth".to_string()),
        1 => Some("stable".to_string()),
        2 => Some("cl8y".to_string()),
        _ => None,
    }
}

async fn arena_buys(State(state): State<AppState>, Query(p): Query<PageParams>) -> Response {
    let limit = p.limit.clamp(1, 200);
    let offset = p.offset.max(0);
    let cursor = match parse_cursor(p.cursor.as_deref()) {
        None => None,
        Some(Ok(c)) => Some(c),
        Some(Err(msg)) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": msg })),
            )
                .into_response();
        }
    };
    let (cursor_block, cursor_log) = match cursor {
        Some(c) => (Some(c.block_number), Some(c.log_index)),
        None => (None, None),
    };
    let effective_offset = if cursor.is_some() { 0 } else { offset };

    let rows = match sqlx::query(
        r#"SELECT b.buyer, b.charm_wad::text, b.doub_paid::text, b.block_number, b.tx_hash,
                  b.timer_hard_reset, b.paid_with_cred, b.actual_seconds_added::text,
                  b.new_deadline::text, b.buy_index::text, b.log_index,
                  EXTRACT(EPOCH FROM b.block_timestamp)::text AS block_timestamp_sec,
                  k.pay_kind AS kumbaya_pay_kind_raw,
                  k.gross_doub::text AS router_attested_gross_doub
           FROM idx_arena_buy b
           LEFT JOIN LATERAL (
               SELECT kk.pay_kind, kk.gross_doub
               FROM idx_arena_buy_router_kumbaya kk
               WHERE kk.tx_hash = b.tx_hash
                 AND lower(kk.buyer) = lower(b.buyer)
                 AND kk.charm_wad = b.charm_wad
               ORDER BY kk.log_index DESC
               LIMIT 1
           ) k ON true
           WHERE ($3::bigint IS NULL OR (b.block_number, b.log_index) < ($3, $4))
           ORDER BY b.block_timestamp DESC NULLS LAST, b.block_number DESC, b.log_index DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit)
    .bind(effective_offset)
    .bind(cursor_block)
    .bind(cursor_log)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/buys", e),
    };
    let row_count = rows.len() as i64;
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
                "actual_seconds_added": r.get::<String, _>("actual_seconds_added"),
                "new_deadline": r.get::<String, _>("new_deadline"),
                "buy_index": r.get::<String, _>("buy_index"),
                "log_index": r.get::<i32, _>("log_index"),
                "block_timestamp": r.get::<Option<String>, _>("block_timestamp_sec"),
                "entry_pay_asset": kumbaya_entry_pay_asset(
                    r.get::<Option<i16>, _>("kumbaya_pay_kind_raw"),
                ),
                "pay_kind": r.get::<Option<i16>, _>("kumbaya_pay_kind_raw"),
                "router_attested_gross_doub": r.get::<Option<String>, _>("router_attested_gross_doub"),
            })
        })
        .collect();

    let next_cursor = if row_count == limit {
        rows.last().map(|r| {
            encode_cursor(
                r.get::<i64, _>("block_number"),
                r.get::<i32, _>("log_index"),
            )
        })
    } else {
        None
    };

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({
            "items": items,
            "limit": limit,
            "offset": effective_offset,
            "next_offset": if cursor.is_none() && row_count == limit {
                Some(offset + limit)
            } else {
                None
            },
            "next_cursor": next_cursor,
        })),
    )
        .into_response()
}

async fn arena_activity(State(state): State<AppState>, Query(p): Query<PageParams>) -> Response {
    let limit = p.limit.clamp(1, 200);
    let offset = p.offset.max(0);
    let cursor = match parse_cursor(p.cursor.as_deref()) {
        None => None,
        Some(Ok(c)) => Some(c),
        Some(Err(msg)) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": msg })),
            )
                .into_response();
        }
    };
    let (cursor_block, cursor_log) = match cursor {
        Some(c) => (Some(c.block_number), Some(c.log_index)),
        None => (None, None),
    };
    let effective_offset = if cursor.is_some() { 0 } else { offset };

    let rows = match sqlx::query(
        r#"SELECT *
           FROM (
               SELECT 'buy' AS kind,
                      buyer AS actor,
                      NULL::text AS target,
                      charm_wad::text AS charm_wad,
                      doub_paid::text AS amount_doub_wad,
                      actual_seconds_added::text AS seconds_delta,
                      NULL::text AS bp_delta,
                      NULL::text AS guard_until,
                      timer_hard_reset,
                      paid_with_cred,
                      NULL::boolean AS limit_bypass,
                      block_number,
                      tx_hash,
                      log_index,
                      EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec
               FROM idx_arena_buy
               UNION ALL
               SELECT 'steal' AS kind,
                      attacker AS actor,
                      victim AS target,
                      NULL::text AS charm_wad,
                      doub_spent::text AS amount_doub_wad,
                      NULL::text AS seconds_delta,
                      bp_taken::text AS bp_delta,
                      NULL::text AS guard_until,
                      NULL::boolean AS timer_hard_reset,
                      NULL::boolean AS paid_with_cred,
                      limit_bypass,
                      block_number,
                      tx_hash,
                      log_index,
                      EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec
               FROM idx_arena_warbow_steal
               UNION ALL
               SELECT 'guard' AS kind,
                      player AS actor,
                      NULL::text AS target,
                      NULL::text AS charm_wad,
                      doub_spent::text AS amount_doub_wad,
                      NULL::text AS seconds_delta,
                      NULL::text AS bp_delta,
                      guard_until::text AS guard_until,
                      NULL::boolean AS timer_hard_reset,
                      NULL::boolean AS paid_with_cred,
                      NULL::boolean AS limit_bypass,
                      block_number,
                      tx_hash,
                      log_index,
                      EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec
               FROM idx_arena_warbow_guard
               UNION ALL
               SELECT 'revenge' AS kind,
                      avenger AS actor,
                      stealer AS target,
                      NULL::text AS charm_wad,
                      doub_spent::text AS amount_doub_wad,
                      NULL::text AS seconds_delta,
                      bp_taken::text AS bp_delta,
                      NULL::text AS guard_until,
                      NULL::boolean AS timer_hard_reset,
                      NULL::boolean AS paid_with_cred,
                      NULL::boolean AS limit_bypass,
                      block_number,
                      tx_hash,
                      log_index,
                      EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec
               FROM idx_arena_warbow_revenge
           ) activity
           WHERE ($3::bigint IS NULL OR (block_number, log_index) < ($3, $4))
           ORDER BY block_number DESC, log_index DESC
           LIMIT $1 OFFSET $2"#,
    )
    .bind(limit)
    .bind(effective_offset)
    .bind(cursor_block)
    .bind(cursor_log)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/activity", e),
    };
    let row_count = rows.len() as i64;
    let items: Vec<_> = rows
        .iter()
        .map(|r| {
            json!({
                "kind": r.get::<String, _>("kind"),
                "actor": r.get::<String, _>("actor"),
                "target": r.get::<Option<String>, _>("target"),
                "charm_wad": r.get::<Option<String>, _>("charm_wad"),
                "amount_doub_wad": r.get::<Option<String>, _>("amount_doub_wad"),
                "seconds_delta": r.get::<Option<String>, _>("seconds_delta"),
                "bp_delta": r.get::<Option<String>, _>("bp_delta"),
                "guard_until": r.get::<Option<String>, _>("guard_until"),
                "timer_hard_reset": r.get::<Option<bool>, _>("timer_hard_reset"),
                "paid_with_cred": r.get::<Option<bool>, _>("paid_with_cred"),
                "limit_bypass": r.get::<Option<bool>, _>("limit_bypass"),
                "block_number": r.get::<i64, _>("block_number"),
                "tx_hash": r.get::<String, _>("tx_hash"),
                "log_index": r.get::<i32, _>("log_index"),
                "block_timestamp": r.get::<Option<String>, _>("block_timestamp_sec"),
            })
        })
        .collect();

    let next_cursor = if row_count == limit {
        rows.last().map(|r| {
            encode_cursor(
                r.get::<i64, _>("block_number"),
                r.get::<i32, _>("log_index"),
            )
        })
    } else {
        None
    };

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({
            "items": items,
            "limit": limit,
            "offset": effective_offset,
            "next_offset": if cursor.is_none() && row_count == limit {
                Some(offset + limit)
            } else {
                None
            },
            "next_cursor": next_cursor,
        })),
    )
        .into_response()
}

#[derive(Debug, serde::Deserialize)]
struct WarbowLatestBpQuery {
    players: String,
}

/// Latest indexed `battlePoints` snapshot per player (`idx_warbow_epoch_score`).
async fn arena_warbow_latest_bp(
    State(state): State<AppState>,
    Query(p): Query<WarbowLatestBpQuery>,
) -> Response {
    let players: Vec<String> = p
        .players
        .split(',')
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| s.starts_with("0x") && s.len() == 42)
        .take(32)
        .collect();
    if players.is_empty() {
        return (
            StatusCode::OK,
            with_schema_version(axum::http::HeaderMap::new()),
            Json(json!({ "items": [] })),
        )
            .into_response();
    }

    let rows = match sqlx::query(
        r#"SELECT player, battle_points::text AS bp
           FROM (
               SELECT DISTINCT ON (player) player, battle_points, block_number, log_index
               FROM idx_warbow_epoch_score
               WHERE player = ANY($1)
               ORDER BY player, block_number DESC, log_index DESC
           ) latest"#,
    )
    .bind(&players)
    .fetch_all(&state.pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/warbow/latest-bp", e),
    };

    let items: Vec<_> = rows
        .iter()
        .map(|r| {
            json!({
                "player": r.get::<String, _>("player"),
                "battle_points": r.get::<String, _>("bp"),
            })
        })
        .collect();

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(json!({ "items": items })),
    )
        .into_response()
}

async fn arena_wallet_stats(
    State(state): State<AppState>,
    Path(address): Path<String>,
) -> Response {
    let w = address.trim().to_ascii_lowercase();
    if !w.starts_with("0x") || w.len() != 42 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({ "error": "invalid_address" })),
        )
            .into_response();
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

async fn arena_vault_funding_recent(
    State(state): State<AppState>,
    Query(p): Query<PageParams>,
) -> Response {
    let limit = p.limit.clamp(1, 200);
    let offset = p.offset.max(0);

    let rows = match sqlx::query(
        r#"SELECT kind, podium_id, target_epoch::text AS target_epoch,
                  amount_doub_wad::text AS amount,
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
                "target_epoch": r.get::<Option<String>, _>("target_epoch"),
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
        r#"SELECT kind, podium_id, target_epoch::text AS target_epoch,
                  amount_doub_wad::text AS amount, pool_address, log_index
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
                "target_epoch": r.get::<Option<String>, _>("target_epoch"),
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

// SPDX-License-Identifier: AGPL-3.0-or-later

//! `GET /v1/arena/platform-usage` — network-wide sale + WarBow aggregates (GitLab #231, #319).

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use sqlx::{PgPool, Row};

use crate::api::{internal_db_error_response, with_schema_version, AppState};

#[derive(Debug, serde::Deserialize)]
pub struct PlatformUsageParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    #[serde(default = "default_velocity_window")]
    pub velocity_window: String,
}

fn default_limit() -> i64 {
    20
}

fn default_velocity_window() -> String {
    "1h".to_string()
}

fn clamp_limit(l: i64) -> i64 {
    l.clamp(1, 200)
}

#[derive(Debug, Clone, Copy)]
enum VelocityWindow {
    Trailing {
        window_sec: i64,
        window_hours: i64,
        label: &'static str,
    },
    Sale,
}

fn parse_velocity_window(s: &str) -> Result<VelocityWindow, &'static str> {
    match s.trim().to_ascii_lowercase().as_str() {
        "1h" => Ok(VelocityWindow::Trailing {
            window_sec: 3600,
            window_hours: 1,
            label: "1h",
        }),
        "24h" => Ok(VelocityWindow::Trailing {
            window_sec: 86400,
            window_hours: 24,
            label: "24h",
        }),
        "sale" => Ok(VelocityWindow::Sale),
        _ => Err("velocity_window must be 1h, 24h, or sale"),
    }
}

async fn platform_usage_timer_secs(state: &AppState) -> (i64, i64) {
    let snapshot = {
        let guard = state.chain_timer.read().await;
        guard.as_ref().cloned()
    };

    let mut anchor = None;
    let mut sale_start = None;
    let mut need_anchor_fallback = snapshot.is_none();
    let mut need_sale_start_fallback = snapshot.is_none();

    if let Some(snap) = snapshot {
        if let Ok(ts) = snap.timer.block_timestamp_sec.parse::<i64>() {
            if ts > 0 {
                anchor = Some(ts);
            } else {
                need_anchor_fallback = true;
            }
        } else {
            need_anchor_fallback = true;
        }

        match snap.timer.sale_start_sec.parse::<i64>() {
            Ok(ts) => sale_start = Some(ts),
            Err(_) => need_sale_start_fallback = true,
        }
    }

    if need_anchor_fallback || need_sale_start_fallback {
        let row = sqlx::query(
            r#"SELECT
                  COALESCE(EXTRACT(EPOCH FROM MAX(block_timestamp))::bigint, 0) AS anchor,
                  COALESCE((
                    SELECT start_timestamp::bigint
                      FROM idx_arena_started
                     ORDER BY block_number DESC
                     LIMIT 1
                  ), 0)::bigint AS sale_start
                 FROM idx_arena_buy"#,
        )
        .fetch_one(&state.pool)
        .await;

        match row {
            Ok(r) => {
                if need_anchor_fallback {
                    anchor = Some(r.try_get::<i64, _>("anchor").unwrap_or(0));
                }
                if need_sale_start_fallback {
                    sale_start = Some(r.try_get::<i64, _>("sale_start").unwrap_or(0));
                }
            }
            Err(_) => {
                if need_anchor_fallback {
                    anchor = Some(0);
                }
                if need_sale_start_fallback {
                    sale_start = Some(0);
                }
            }
        }
    }

    (anchor.unwrap_or(0), sale_start.unwrap_or(0))
}

async fn fetch_warbow_action_totals(
    pool: &PgPool,
    table: &'static str,
    where_clause: Option<&'static str>,
) -> Result<(String, String), sqlx::Error> {
    let sql = match where_clause {
        Some(wc) => format!(
            "SELECT COUNT(*)::text AS cnt, COALESCE(SUM(doub_spent), 0)::text AS doub FROM {table} WHERE {wc}"
        ),
        None => format!(
            "SELECT COUNT(*)::text AS cnt, COALESCE(SUM(doub_spent), 0)::text AS doub FROM {table}"
        ),
    };
    let row = sqlx::query(&sql).fetch_one(pool).await?;
    let count: String = row.try_get("cnt").unwrap_or_else(|_| "0".into());
    let doub: String = row.try_get("doub").unwrap_or_else(|_| "0".into());
    Ok((count, doub))
}

fn warbow_action_json(count: String, cl8y_spent_wei: String) -> serde_json::Value {
    json!({
        "count": count,
        "cl8y_spent_wei": cl8y_spent_wei,
    })
}

fn format_avg_buys_per_hour(buy_count: i64, window_hours: i64) -> String {
    if window_hours <= 0 {
        return "0".to_string();
    }
    let avg = buy_count as f64 / window_hours as f64;
    if avg.fract() == 0.0 && avg >= 0.0 && avg <= i64::MAX as f64 {
        format!("{}", avg as i64)
    } else {
        format!("{avg:.6}")
    }
}

pub async fn arena_platform_usage(
    State(state): State<AppState>,
    Query(p): Query<PlatformUsageParams>,
) -> Response {
    let velocity = match parse_velocity_window(&p.velocity_window) {
        Ok(v) => v,
        Err(msg) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": msg })),
            )
                .into_response();
        }
    };

    let lim = clamp_limit(p.limit);
    let off = p.offset.max(0);

    let summary = sqlx::query(
        r#"SELECT
              (SELECT COUNT(*)::bigint FROM (
                 SELECT buyer AS addr FROM idx_arena_buy
                 UNION
                 SELECT attacker FROM idx_arena_warbow_steal
                 UNION
                 SELECT victim FROM idx_arena_warbow_steal
                 UNION
                 SELECT avenger FROM idx_arena_warbow_revenge
                 UNION
                 SELECT stealer FROM idx_arena_warbow_revenge
                 UNION
                 SELECT player FROM idx_arena_warbow_guard
               ) u) AS unique_wallets,
              (SELECT COUNT(*)::bigint FROM idx_arena_buy) AS total_buys,
              (SELECT COUNT(DISTINCT buyer)::bigint FROM idx_arena_buy) AS unique_buyers,
              (SELECT COALESCE(
                 (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY cnt)
                    FROM (
                      SELECT COUNT(*)::numeric AS cnt
                        FROM idx_arena_buy
                       GROUP BY buyer
                    ) per_buyer),
                 0
               )::text) AS median_buys_per_wallet"#,
    )
    .fetch_one(&state.pool)
    .await;

    let summary = match summary {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/platform-usage summary", e),
    };

    let unique_wallets: i64 = summary.try_get("unique_wallets").unwrap_or(0);
    let total_buys: i64 = summary.try_get("total_buys").unwrap_or(0);
    let unique_buyers: i64 = summary.try_get("unique_buyers").unwrap_or(0);
    let median_buys_per_wallet: String = summary
        .try_get("median_buys_per_wallet")
        .unwrap_or_else(|_| "0".into());

    let mean_buys_per_wallet = if unique_buyers == 0 {
        "0".to_string()
    } else {
        format!("{}", total_buys as f64 / unique_buyers as f64)
    };

    let steals = match fetch_warbow_action_totals(&state.pool, "idx_arena_warbow_steal", None).await
    {
        Ok(v) => v,
        Err(e) => {
            return internal_db_error_response("GET /v1/arena/platform-usage warbow steals", e);
        }
    };
    let steal_overrides = match fetch_warbow_action_totals(
        &state.pool,
        "idx_arena_warbow_steal",
        Some("limit_bypass = true"),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => {
            return internal_db_error_response(
                "GET /v1/arena/platform-usage warbow steal overrides",
                e,
            );
        }
    };
    let revenges =
        match fetch_warbow_action_totals(&state.pool, "idx_arena_warbow_revenge", None).await {
            Ok(v) => v,
            Err(e) => {
                return internal_db_error_response("GET /v1/arena/platform-usage warbow revenges", e);
            }
        };
    let guards = match fetch_warbow_action_totals(&state.pool, "idx_arena_warbow_guard", None).await
    {
        Ok(v) => v,
        Err(e) => return internal_db_error_response("GET /v1/arena/platform-usage warbow guards", e),
    };

    let (anchor, sale_start) = platform_usage_timer_secs(&state).await;
    let (window_start, window_hours, window_label) = match velocity {
        VelocityWindow::Trailing {
            window_sec,
            window_hours,
            label,
        } => (anchor.saturating_sub(window_sec), window_hours, label),
        VelocityWindow::Sale => {
            if sale_start == 0 || anchor < sale_start {
                (anchor + 1, 1, "sale")
            } else {
                let elapsed = anchor - sale_start;
                let hours = (elapsed / 3600).max(1);
                (sale_start, hours, "sale")
            }
        }
    };

    let velocity_row = sqlx::query(
        r#"SELECT COUNT(*)::bigint AS buy_count
           FROM idx_arena_buy
          WHERE block_timestamp IS NOT NULL
            AND block_timestamp >= to_timestamp($1)"#,
    )
    .bind(window_start)
    .fetch_one(&state.pool)
    .await;

    let velocity_row = match velocity_row {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/platform-usage velocity", e),
    };
    let velocity_buy_count: i64 = velocity_row.try_get("buy_count").unwrap_or(0);

    let wallet_total: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM (
               SELECT buyer FROM idx_arena_buy GROUP BY buyer
           ) w"#,
    )
    .fetch_one(&state.pool)
    .await
    .unwrap_or(0);

    let wallet_rows = sqlx::query(
        r#"SELECT buyer AS wallet,
                  COUNT(*)::text AS buy_count,
                  COALESCE(SUM(doub_paid), 0)::text AS cl8y_spent_wei
             FROM idx_arena_buy
            GROUP BY buyer
            ORDER BY SUM(doub_paid) DESC, COUNT(*) DESC, buyer ASC
            LIMIT $1 OFFSET $2"#,
    )
    .bind(lim)
    .bind(off)
    .fetch_all(&state.pool)
    .await;

    let wallet_rows = match wallet_rows {
        Ok(r) => r,
        Err(e) => return internal_db_error_response("GET /v1/arena/platform-usage wallets", e),
    };

    let mut wallet_items = Vec::with_capacity(wallet_rows.len());
    for r in wallet_rows {
        wallet_items.push(json!({
            "wallet": r.try_get::<String, _>("wallet").unwrap_or_default(),
            "buy_count": r.try_get::<String, _>("buy_count").unwrap_or_else(|_| "0".into()),
            "cl8y_spent_wei": r.try_get::<String, _>("cl8y_spent_wei").unwrap_or_else(|_| "0".into()),
        }));
    }

    let next_offset = if wallet_items.len() as i64 == lim {
        Some(off + lim)
    } else {
        None
    };

    let body = json!({
        "unique_wallets": unique_wallets.to_string(),
        "total_buys": total_buys.to_string(),
        "unique_buyers": unique_buyers.to_string(),
        "mean_buys_per_wallet": mean_buys_per_wallet,
        "median_buys_per_wallet": median_buys_per_wallet,
        "warbow": {
            "steals": warbow_action_json(steals.0, steals.1),
            "steal_overrides": warbow_action_json(steal_overrides.0, steal_overrides.1),
            "revenges": warbow_action_json(revenges.0, revenges.1),
            "guards": warbow_action_json(guards.0, guards.1),
        },
        "velocity": {
            "window": window_label,
            "anchor_timestamp_sec": anchor.to_string(),
            "buy_count": velocity_buy_count.to_string(),
            "avg_buys_per_hour": format_avg_buys_per_hour(velocity_buy_count, window_hours),
        },
        "wallets": {
            "total": wallet_total.to_string(),
            "items": wallet_items,
            "limit": lim,
            "offset": off,
            "next_offset": next_offset,
        },
    });

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(body),
    )
        .into_response()
}

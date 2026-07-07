// SPDX-License-Identifier: AGPL-3.0-or-later

//! `GET /v1/arena/events` catalog + `GET /v1/arena/events/{id}` detail ([#364](https://gitlab.com/PlasticDigits/yieldomega/-/issues/364)).

use alloy_primitives::U256;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};

use crate::api::{default_limit, internal_db_error_response, with_schema_version, AppState};
use crate::api_cursor::paginated_list_json;
use crate::api_validate::valid_0x_address20;
use crate::arena_podium_epoch::settled_epoch_str_from_roll_event;
use crate::arena_podium_live::podium_label_for_onchain_category;
use crate::arena_podium_prize::payout_shares;

pub const MAX_EVENTS_LIMIT: i64 = 200;
pub const MAX_SEARCH_LEN: usize = 200;
pub const MAX_RELATED_BUYS: i64 = 50;

#[derive(Debug, Deserialize)]
pub struct EventsListParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    /// `all` | `podium_settlement` | `last_buy_epoch_start`
    pub kind: Option<String>,
    /// Substring match on title, epoch, addresses, or tx hash.
    pub q: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArenaEventKind {
    PodiumSettlement,
    LastBuyEpochStart,
}

impl ArenaEventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::PodiumSettlement => "podium_settlement",
            Self::LastBuyEpochStart => "last_buy_epoch_start",
        }
    }

    pub fn parse(raw: &str) -> Option<Self> {
        match raw.trim().to_ascii_lowercase().as_str() {
            "podium_settlement" => Some(Self::PodiumSettlement),
            "last_buy_epoch_start" => Some(Self::LastBuyEpochStart),
            _ => None,
        }
    }
}

/// Stable event id: `{kind}:{tx_hash}:{log_index}` (lowercase tx).
pub fn event_id(kind: ArenaEventKind, tx_hash: &str, log_index: i32) -> String {
    format!(
        "{}:{}:{}",
        kind.as_str(),
        tx_hash.trim().to_ascii_lowercase(),
        log_index
    )
}

/// URL slug for share links (not guaranteed unique across chains; id is canonical).
pub fn event_slug(kind: ArenaEventKind, category: Option<u8>, settled_epoch: &str) -> String {
    match kind {
        ArenaEventKind::PodiumSettlement => {
            let label = category
                .map(podium_label_for_onchain_category)
                .unwrap_or("unknown");
            format!("{label}-epoch-{settled_epoch}")
        }
        ArenaEventKind::LastBuyEpochStart => format!("last-buy-epoch-{settled_epoch}"),
    }
}

fn podium_ux_label(category: u8) -> &'static str {
    match category {
        0 => "Last Buy",
        3 => "WarBow",
        2 => "Defended Streak",
        1 => "Time Booster",
        _ => "Arena",
    }
}

fn address_tail(addr: &str) -> String {
    let a = addr.trim().to_ascii_lowercase();
    if a.len() >= 10 {
        format!("0x{}…{}", &a[2..6], &a[a.len() - 4..])
    } else {
        a
    }
}

pub fn podium_settlement_title(category: u8, settled_epoch: &str, first_place: Option<&str>) -> String {
    let label = podium_ux_label(category);
    let epoch = settled_epoch;
    match first_place.filter(|a| valid_0x_address20(a)) {
        Some(winner) => format!(
            "{label} Epoch {epoch} — {} wins 1st",
            address_tail(winner)
        ),
        None => format!("{label} Epoch {epoch} settlement"),
    }
}

pub fn last_buy_epoch_title(epoch: &str) -> String {
    format!("Last Buy Epoch {epoch} started")
}

pub fn parse_event_id(raw: &str) -> Result<(ArenaEventKind, String, i32), &'static str> {
    let s = raw.trim();
    let (kind_part, rest) = s.split_once(':').ok_or("invalid_event_id")?;
    let kind = ArenaEventKind::parse(kind_part).ok_or("invalid_event_id")?;
    let (tx_hash, log_index_str) = rest.rsplit_once(':').ok_or("invalid_event_id")?;
    if !tx_hash.starts_with("0x") || tx_hash.len() != 66 {
        return Err("invalid_event_id");
    }
    let log_index: i32 = log_index_str.parse().map_err(|_| "invalid_event_id")?;
    if log_index < 0 {
        return Err("invalid_event_id");
    }
    Ok((kind, tx_hash.to_ascii_lowercase(), log_index))
}

fn normalize_search(q: Option<String>) -> Option<String> {
    let s = q?.trim().to_string();
    if s.is_empty() {
        return None;
    }
    Some(s.chars().take(MAX_SEARCH_LEN).collect())
}

fn kind_filter_sql(kind: Option<ArenaEventKind>) -> Option<&'static str> {
    kind.map(ArenaEventKind::as_str)
}

const EVENTS_UNION_SQL: &str = r#"
    SELECT 'podium_settlement' AS kind,
           category::int AS category,
           epoch::text AS roll_epoch,
           first_place,
           second_place,
           third_place,
           pool_paid::text AS pool_paid,
           NULL::text AS deadline,
           block_number,
           tx_hash,
           log_index,
           EXTRACT(EPOCH FROM block_timestamp)::bigint AS block_timestamp_sec
    FROM idx_arena_podium_epoch
    UNION ALL
    SELECT 'last_buy_epoch_start' AS kind,
           NULL::int AS category,
           epoch::text AS roll_epoch,
           NULL::text AS first_place,
           NULL::text AS second_place,
           NULL::text AS third_place,
           NULL::text AS pool_paid,
           deadline::text AS deadline,
           block_number,
           tx_hash,
           log_index,
           EXTRACT(EPOCH FROM block_timestamp)::bigint AS block_timestamp_sec
    FROM idx_arena_last_buy_epoch_started
"#;

fn row_to_list_item(r: &sqlx::postgres::PgRow) -> Value {
    let kind: String = r.get("kind");
    let category: Option<i32> = r.try_get("category").ok();
    let roll_epoch: String = r.get("roll_epoch");
    let first_place: Option<String> = r.try_get("first_place").ok();
    let block_number: i64 = r.get("block_number");
    let tx_hash: String = r.get("tx_hash");
    let log_index: i32 = r.get("log_index");
    let block_timestamp_sec: Option<i64> = r.try_get("block_timestamp_sec").ok();

    let event_kind = ArenaEventKind::parse(&kind).expect("union kind");
    let settled_epoch = match event_kind {
        ArenaEventKind::PodiumSettlement => settled_epoch_str_from_roll_event(&roll_epoch),
        ArenaEventKind::LastBuyEpochStart => roll_epoch.clone(),
    };
    let title = match event_kind {
        ArenaEventKind::PodiumSettlement => podium_settlement_title(
            category.unwrap_or(-1) as u8,
            &settled_epoch,
            first_place.as_deref(),
        ),
        ArenaEventKind::LastBuyEpochStart => last_buy_epoch_title(&settled_epoch),
    };
    let subtitle = match event_kind {
        ArenaEventKind::PodiumSettlement => {
            let label = category
                .map(|c| podium_ux_label(c as u8).to_string())
                .unwrap_or_else(|| "Arena".to_string());
            format!("{label} podium settlement")
        }
        ArenaEventKind::LastBuyEpochStart => "Last Buy hard reset".to_string(),
    };
    let slug = event_slug(
        event_kind,
        category.map(|c| c as u8),
        &settled_epoch,
    );
    let id = event_id(event_kind, &tx_hash, log_index);
    let podium = category.map(|c| podium_label_for_onchain_category(c as u8));

    json!({
        "id": id,
        "kind": kind,
        "slug": slug,
        "title": title,
        "subtitle": subtitle,
        "block_timestamp": block_timestamp_sec.map(|s| s.to_string()),
        "podium": podium,
        "category": category,
        "epoch": settled_epoch,
        "tx_hash": tx_hash,
        "block_number": block_number.to_string(),
        "log_index": log_index,
    })
}

async fn fetch_events_list(
    pool: &PgPool,
    limit: i64,
    offset: i64,
    kind_filter: Option<&str>,
    search: Option<&str>,
) -> Result<Vec<Value>, sqlx::Error> {
    let search_pat = search.map(|s| format!("%{s}%"));

    let sql = format!(
        r#"SELECT * FROM (
            {EVENTS_UNION_SQL}
        ) events
        WHERE ($1::text IS NULL OR kind = $1)
          AND ($2::text IS NULL OR (
                kind ILIKE $2 OR roll_epoch ILIKE $2 OR tx_hash ILIKE $2
                OR COALESCE(first_place, '') ILIKE $2
                OR COALESCE(second_place, '') ILIKE $2
                OR COALESCE(third_place, '') ILIKE $2
          ))
        ORDER BY block_timestamp_sec DESC NULLS LAST, block_number DESC, log_index DESC
        LIMIT $3 OFFSET $4"#
    );
    let rows = sqlx::query(&sql)
        .bind(kind_filter)
        .bind(search_pat)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await?;

    Ok(rows.iter().map(row_to_list_item).collect())
}

pub async fn arena_events_list(
    State(state): State<AppState>,
    Query(params): Query<EventsListParams>,
) -> Response {
    let limit = params.limit.clamp(1, MAX_EVENTS_LIMIT);
    let offset = params.offset.max(0);
    let kind_filter = match params.kind.as_deref() {
        None | Some("all") | Some("") => None,
        Some(raw) => match ArenaEventKind::parse(raw) {
            Some(k) => Some(k),
            None => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({ "error": "invalid_kind" })),
                )
                    .into_response();
            }
        },
    };
    let search = normalize_search(params.q);

    let items = match fetch_events_list(
        &state.pool,
        limit,
        offset,
        kind_filter_sql(kind_filter),
        search.as_deref(),
    )
    .await
    {
        Ok(v) => v,
        Err(e) => return internal_db_error_response("GET /v1/arena/events", e),
    };

    let next_offset = if (items.len() as i64) < limit {
        None
    } else {
        Some(offset + limit)
    };

    paginated_list_json(items, limit, offset, None, next_offset)
}

async fn fetch_podium_detail(
    pool: &PgPool,
    tx_hash: &str,
    log_index: i32,
) -> Result<Option<Value>, sqlx::Error> {
    let row = sqlx::query(
        r#"SELECT category, epoch::text AS roll_epoch,
                  first_place, second_place, third_place,
                  pool_paid::text AS pool_paid,
                  block_number, tx_hash, log_index,
                  EXTRACT(EPOCH FROM block_timestamp)::bigint AS block_timestamp_sec
           FROM idx_arena_podium_epoch
           WHERE tx_hash = $1 AND log_index = $2"#,
    )
    .bind(tx_hash)
    .bind(log_index)
    .fetch_optional(pool)
    .await?;

    let Some(r) = row else {
        return Ok(None);
    };

    let category: i16 = r.get("category");
    let roll_epoch: String = r.get("roll_epoch");
    let settled_epoch = settled_epoch_str_from_roll_event(&roll_epoch);
    let pool_paid: String = r.get("pool_paid");
    let pool_amount = U256::from_str_radix(pool_paid.as_str(), 10).unwrap_or(U256::ZERO);
    let (first_prize, second_prize, third_prize) = payout_shares(pool_amount);
    let first_place: Option<String> = r.try_get("first_place").ok();
    let second_place: Option<String> = r.try_get("second_place").ok();
    let third_place: Option<String> = r.try_get("third_place").ok();
    let block_number: i64 = r.get("block_number");
    let block_timestamp_sec: Option<i64> = r.try_get("block_timestamp_sec").ok();
    let tx_hash: String = r.get("tx_hash");
    let log_index: i32 = r.get("log_index");

    let kind = ArenaEventKind::PodiumSettlement;
    let title = podium_settlement_title(category as u8, &settled_epoch, first_place.as_deref());
    let related_buys = fetch_related_buys_before_block(pool, block_number, MAX_RELATED_BUYS).await?;

    Ok(Some(json!({
        "id": event_id(kind, &tx_hash, log_index),
        "kind": kind.as_str(),
        "slug": event_slug(kind, Some(category as u8), &settled_epoch),
        "title": title,
        "subtitle": format!("{} podium settlement", podium_ux_label(category as u8)),
        "block_timestamp": block_timestamp_sec.map(|s| s.to_string()),
        "podium": podium_label_for_onchain_category(category as u8),
        "category": category,
        "epoch": settled_epoch,
        "roll_epoch": roll_epoch,
        "tx_hash": tx_hash,
        "block_number": block_number.to_string(),
        "log_index": log_index,
        "pool_paid_doub_wad": pool_paid,
        "winners": [
            { "rank": 1, "address": first_place, "prize_doub_wad": first_prize.to_string() },
            { "rank": 2, "address": second_place, "prize_doub_wad": second_prize.to_string() },
            { "rank": 3, "address": third_place, "prize_doub_wad": third_prize.to_string() },
        ],
        "chart_buys": related_buys,
    })))
}

async fn fetch_last_buy_epoch_detail(
    pool: &PgPool,
    tx_hash: &str,
    log_index: i32,
) -> Result<Option<Value>, sqlx::Error> {
    let row = sqlx::query(
        r#"SELECT epoch::text AS epoch, deadline::text AS deadline,
                  block_number, tx_hash, log_index,
                  EXTRACT(EPOCH FROM block_timestamp)::bigint AS block_timestamp_sec
           FROM idx_arena_last_buy_epoch_started
           WHERE tx_hash = $1 AND log_index = $2"#,
    )
    .bind(tx_hash)
    .bind(log_index)
    .fetch_optional(pool)
    .await?;

    let Some(r) = row else {
        return Ok(None);
    };

    let epoch: String = r.get("epoch");
    let deadline: String = r.get("deadline");
    let block_number: i64 = r.get("block_number");
    let block_timestamp_sec: Option<i64> = r.try_get("block_timestamp_sec").ok();
    let tx_hash: String = r.get("tx_hash");
    let log_index: i32 = r.get("log_index");

    let kind = ArenaEventKind::LastBuyEpochStart;
    let epoch_i64: i64 = epoch.parse().unwrap_or(0);
    let related_buys =
        fetch_buys_for_last_buy_epoch(pool, epoch_i64, MAX_RELATED_BUYS).await?;

    Ok(Some(json!({
        "id": event_id(kind, &tx_hash, log_index),
        "kind": kind.as_str(),
        "slug": event_slug(kind, None, &epoch),
        "title": last_buy_epoch_title(&epoch),
        "subtitle": "Last Buy hard reset",
        "block_timestamp": block_timestamp_sec.map(|s| s.to_string()),
        "epoch": epoch,
        "deadline_sec": deadline,
        "tx_hash": tx_hash,
        "block_number": block_number.to_string(),
        "log_index": log_index,
        "chart_buys": related_buys,
    })))
}

async fn fetch_related_buys_before_block(
    pool: &PgPool,
    block_number: i64,
    limit: i64,
) -> Result<Vec<Value>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT buyer, doub_paid::text AS amount, charm_wad::text AS charm_wad,
                  new_deadline::text AS new_deadline,
                  total_doub_raised_after::text AS total_raised_after,
                  buy_index::text AS buy_index,
                  actual_seconds_added::text AS actual_seconds_added,
                  block_number, tx_hash, log_index,
                  EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec
           FROM idx_arena_buy
           WHERE block_number <= $1
           ORDER BY block_number DESC, log_index DESC
           LIMIT $2"#,
    )
    .bind(block_number)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.iter().map(buy_row_json).collect())
}

async fn fetch_buys_for_last_buy_epoch(
    pool: &PgPool,
    epoch: i64,
    limit: i64,
) -> Result<Vec<Value>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT buyer, doub_paid::text AS amount, charm_wad::text AS charm_wad,
                  new_deadline::text AS new_deadline,
                  total_doub_raised_after::text AS total_raised_after,
                  buy_index::text AS buy_index,
                  actual_seconds_added::text AS actual_seconds_added,
                  block_number, tx_hash, log_index,
                  EXTRACT(EPOCH FROM block_timestamp)::text AS block_timestamp_sec
           FROM idx_arena_buy
           WHERE last_buy_epoch = $1
           ORDER BY block_number ASC, log_index ASC
           LIMIT $2"#,
    )
    .bind(epoch)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows.iter().map(buy_row_json).collect())
}

fn buy_row_json(r: &sqlx::postgres::PgRow) -> Value {
    json!({
        "buyer": r.get::<String, _>("buyer"),
        "amount": r.get::<String, _>("amount"),
        "charm_wad": r.get::<String, _>("charm_wad"),
        "new_deadline": r.get::<String, _>("new_deadline"),
        "total_raised_after": r.get::<String, _>("total_raised_after"),
        "buy_index": r.get::<String, _>("buy_index"),
        "actual_seconds_added": r.get::<String, _>("actual_seconds_added"),
        "block_number": r.get::<i64, _>("block_number").to_string(),
        "tx_hash": r.get::<String, _>("tx_hash"),
        "log_index": r.get::<i32, _>("log_index"),
        "block_timestamp": r.get::<Option<String>, _>("block_timestamp_sec"),
    })
}

pub async fn arena_events_detail(
    State(state): State<AppState>,
    Path(event_id_raw): Path<String>,
) -> Response {
    let (kind, tx_hash, log_index) = match parse_event_id(&event_id_raw) {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({ "error": "invalid_event_id" })),
            )
                .into_response();
        }
    };

    let body = match kind {
        ArenaEventKind::PodiumSettlement => {
            match fetch_podium_detail(&state.pool, &tx_hash, log_index).await {
                Ok(Some(v)) => v,
                Ok(None) => {
                    return (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" })))
                        .into_response();
                }
                Err(e) => return internal_db_error_response("GET /v1/arena/events/{id}", e),
            }
        }
        ArenaEventKind::LastBuyEpochStart => {
            match fetch_last_buy_epoch_detail(&state.pool, &tx_hash, log_index).await {
                Ok(Some(v)) => v,
                Ok(None) => {
                    return (StatusCode::NOT_FOUND, Json(json!({ "error": "not_found" })))
                        .into_response();
                }
                Err(e) => return internal_db_error_response("GET /v1/arena/events/{id}", e),
            }
        }
    };

    (
        StatusCode::OK,
        with_schema_version(axum::http::HeaderMap::new()),
        Json(body),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn event_id_round_trip() {
        let id = event_id(
            ArenaEventKind::PodiumSettlement,
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
            3,
        );
        let (kind, tx, log) = parse_event_id(&id).unwrap();
        assert_eq!(kind, ArenaEventKind::PodiumSettlement);
        assert_eq!(log, 3);
        assert!(tx.starts_with("0x"));
    }

    #[test]
    fn parse_rejects_bad_id() {
        assert!(parse_event_id("").is_err());
        assert!(parse_event_id("nope").is_err());
        assert!(parse_event_id("podium_settlement:0x1:0").is_err());
        assert!(parse_event_id("unknown:0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd:1").is_err());
    }

    #[test]
    fn podium_title_includes_winner_tail() {
        let t = podium_settlement_title(
            3,
            "12",
            Some("0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"),
        );
        assert!(t.contains("WarBow Epoch 12"));
        assert!(t.contains("wins 1st"));
    }

    #[test]
    fn slug_formats() {
        assert_eq!(
            event_slug(ArenaEventKind::PodiumSettlement, Some(3), "12"),
            "warbow-epoch-12"
        );
        assert_eq!(
            event_slug(ArenaEventKind::LastBuyEpochStart, None, "5"),
            "last-buy-epoch-5"
        );
    }

    #[test]
    fn kind_parse() {
        assert_eq!(
            ArenaEventKind::parse("podium_settlement"),
            Some(ArenaEventKind::PodiumSettlement)
        );
        assert_eq!(ArenaEventKind::parse("ALL"), None);
    }
}

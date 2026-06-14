// SPDX-License-Identifier: AGPL-3.0-or-later

//! Stable cursor tokens for high-churn list endpoints ([#319](https://gitlab.com/PlasticDigits/yieldomega/-/issues/319)).

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde::Deserialize;
use serde_json::json;

use crate::api::{default_limit, with_schema_version};

/// Opaque list cursor: `(block_number, log_index)` watermark (descending lists).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockLogCursor {
    pub block_number: i64,
    pub log_index: i32,
}

/// Cursor for lists ordered by `block_timestamp DESC NULLS LAST, block_number DESC, log_index DESC`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TimestampBlockLogCursor {
    pub block_timestamp_sec: Option<i64>,
    pub block_number: i64,
    pub log_index: i32,
}

impl TimestampBlockLogCursor {
    pub fn encode(self) -> String {
        let ts = match self.block_timestamp_sec {
            Some(s) => s.to_string(),
            None => "-".to_string(),
        };
        format!("{}:{}:{}", ts, self.block_number, self.log_index)
    }

    pub fn decode(raw: &str) -> Result<Self, &'static str> {
        let s = raw.trim();
        if s.is_empty() {
            return Err("cursor must not be empty");
        }
        let mut parts = s.splitn(3, ':');
        let ts_part = parts.next().ok_or("invalid cursor")?;
        let block_number: i64 = parts
            .next()
            .ok_or("invalid cursor")?
            .parse()
            .map_err(|_| "invalid cursor")?;
        let log_index: i32 = parts
            .next()
            .ok_or("invalid cursor")?
            .parse()
            .map_err(|_| "invalid cursor")?;
        if block_number < 0 || log_index < 0 {
            return Err("invalid cursor");
        }
        let block_timestamp_sec = if ts_part == "-" {
            None
        } else {
            Some(ts_part.parse().map_err(|_| "invalid cursor")?)
        };
        Ok(Self {
            block_timestamp_sec,
            block_number,
            log_index,
        })
    }

    pub fn sort_key_binds(self) -> (i32, i64, i64, i32) {
        let null_rank = if self.block_timestamp_sec.is_some() {
            1
        } else {
            0
        };
        let ts_epoch = self.block_timestamp_sec.unwrap_or(0);
        (null_rank, ts_epoch, self.block_number, self.log_index)
    }
}

impl BlockLogCursor {
    pub fn encode(self) -> String {
        format!("{}:{}", self.block_number, self.log_index)
    }

    pub fn decode(raw: &str) -> Result<Self, &'static str> {
        let s = raw.trim();
        if s.is_empty() {
            return Err("cursor must not be empty");
        }
        let (block, log) = s.split_once(':').ok_or("invalid cursor")?;
        let block_number: i64 = block.parse().map_err(|_| "invalid cursor")?;
        let log_index: i32 = log.parse().map_err(|_| "invalid cursor")?;
        if block_number < 0 || log_index < 0 {
            return Err("invalid cursor");
        }
        Ok(Self {
            block_number,
            log_index,
        })
    }
}

#[derive(Debug, Deserialize)]
pub struct ListPageParams {
    #[serde(default = "default_limit")]
    pub limit: i64,
    #[serde(default)]
    pub offset: i64,
    pub cursor: Option<String>,
}

pub fn bad_cursor_response() -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({ "error": "invalid cursor" })),
    )
        .into_response()
}

pub fn paginated_list_json<T: serde::Serialize>(
    items: Vec<T>,
    limit: i64,
    offset: i64,
    next_cursor: Option<String>,
    next_offset: Option<i64>,
) -> Response {
    let mut res = Json(json!({
        "items": items,
        "limit": limit,
        "offset": offset,
        "next_offset": next_offset,
        "next_cursor": next_cursor,
    }))
    .into_response();
    *res.headers_mut() = with_schema_version(res.headers().clone());
    res
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_cursor() {
        let c = BlockLogCursor {
            block_number: 42,
            log_index: 7,
        };
        assert_eq!(BlockLogCursor::decode(&c.encode()).unwrap(), c);
    }

    #[test]
    fn rejects_negative_parts() {
        assert!(BlockLogCursor::decode("-1:0").is_err());
        assert!(BlockLogCursor::decode("1:-1").is_err());
    }

    #[test]
    fn timestamp_cursor_round_trip() {
        let c = TimestampBlockLogCursor {
            block_timestamp_sec: Some(1_700_000_000),
            block_number: 42,
            log_index: 7,
        };
        assert_eq!(TimestampBlockLogCursor::decode(&c.encode()).unwrap(), c);
        let null_ts = TimestampBlockLogCursor {
            block_timestamp_sec: None,
            block_number: 42,
            log_index: 7,
        };
        assert_eq!(
            TimestampBlockLogCursor::decode(&null_ts.encode()).unwrap(),
            null_ts
        );
    }
}

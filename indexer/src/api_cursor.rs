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
}

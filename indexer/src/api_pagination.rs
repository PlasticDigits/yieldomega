// SPDX-License-Identifier: AGPL-3.0-or-later

//! Cursor pagination helpers for high-churn list routes (GitLab #319).

/// Decoded `(block_number, log_index)` watermark for stable pagination.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BlockLogCursor {
    pub block_number: i64,
    pub log_index: i32,
}

/// Encode cursor as `block_number:log_index` per security model watermarks.
pub fn encode_cursor(block_number: i64, log_index: i32) -> String {
    format!("{block_number}:{log_index}")
}

/// Parse `cursor` query param; returns `None` when unset. Malformed input → `Some(Err(msg))`.
pub fn parse_cursor(raw: Option<&str>) -> Option<Result<BlockLogCursor, &'static str>> {
    let s = raw?;
    let s = s.trim();
    if s.is_empty() {
        return None;
    }
    let (bn, li) = match s.split_once(':') {
        Some(v) => v,
        None => return Some(Err("cursor must be block_number:log_index")),
    };
    let block_number: i64 = match bn.parse() {
        Ok(v) => v,
        Err(_) => return Some(Err("cursor block_number must be a signed integer")),
    };
    let log_index: i32 = match li.parse() {
        Ok(v) => v,
        Err(_) => return Some(Err("cursor log_index must be a signed integer")),
    };
    if block_number < 0 || log_index < 0 {
        return Some(Err("cursor components must be non-negative"));
    }
    Some(Ok(BlockLogCursor {
        block_number,
        log_index,
    }))
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
        let enc = encode_cursor(c.block_number, c.log_index);
        let parsed = parse_cursor(Some(&enc)).unwrap().unwrap();
        assert_eq!(parsed, c);
    }
}

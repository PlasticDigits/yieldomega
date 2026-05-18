// SPDX-License-Identifier: AGPL-3.0-or-later

//! JSON-RPC poll backoff aligned with the frontend (`frontend/src/lib/rpcConnectivity.ts`):
//! **1s** healthy cadence, then **5s → 15s → 30s** after debounced failure streaks, with **HTTP 429**
//! jumping straight to the offline tier.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Same threshold as `RPC_OFFLINE_FAILURE_STREAK` / `INDEXER_OFFLINE_FAILURE_STREAK` in the frontend.
pub const RPC_OFFLINE_FAILURE_STREAK: u32 = 3;

/// Healthy poll interval when the failure streak is below [`RPC_OFFLINE_FAILURE_STREAK`].
pub const RPC_FAST_POLL_MS: u64 = 1000;

const BACKOFF_MS: [u64; 3] = [5_000, 15_000, 30_000];

/// Tracks consecutive failure **seconds** (debounced) for adaptive poll spacing.
#[derive(Debug, Clone)]
pub struct RpcPollHealth {
    failure_streak: u32,
    /// Last Unix second that counted toward the streak (`-1` = none since last success).
    last_fail_unix_sec: i64,
}

impl Default for RpcPollHealth {
    fn default() -> Self {
        Self::new()
    }
}

impl RpcPollHealth {
    pub fn new() -> Self {
        Self {
            failure_streak: 0,
            last_fail_unix_sec: -1,
        }
    }

    fn now_unix_sec() -> i64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0)
    }

    /// Successful RPC cycle — reset streak (matches `reportRpcFetchAttempt(true)`).
    pub fn report_success(&mut self) {
        self.failure_streak = 0;
        self.last_fail_unix_sec = -1;
    }

    /// Failed RPC — at most one streak increment per wall-clock second (`reportRpcFetchAttempt(false)`).
    pub fn report_failure_debounced(&mut self) {
        let sec = Self::now_unix_sec();
        if sec == self.last_fail_unix_sec {
            return;
        }
        self.last_fail_unix_sec = sec;
        self.failure_streak = self.failure_streak.saturating_add(1).min(10_000);
    }

    /// HTTP 429 — jump to offline-tier backoff (`reportRpcRateLimited()`).
    pub fn report_rate_limited(&mut self) {
        self.failure_streak = self.failure_streak.max(RPC_OFFLINE_FAILURE_STREAK);
        self.last_fail_unix_sec = Self::now_unix_sec();
    }

    /// Sleep duration before the next poll attempt (`getRpcBackoffPollMs` with `RPC_FAST_POLL_MS`).
    pub fn backoff_sleep(&self) -> Duration {
        if self.failure_streak < RPC_OFFLINE_FAILURE_STREAK {
            return Duration::from_millis(RPC_FAST_POLL_MS);
        }
        let tier = (self.failure_streak - RPC_OFFLINE_FAILURE_STREAK) as usize;
        let tier = tier.min(BACKOFF_MS.len() - 1);
        Duration::from_millis(BACKOFF_MS[tier])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fast_poll_while_under_threshold() {
        let mut h = RpcPollHealth::new();
        h.failure_streak = RPC_OFFLINE_FAILURE_STREAK - 1;
        assert_eq!(h.backoff_sleep(), Duration::from_millis(RPC_FAST_POLL_MS));
    }

    #[test]
    fn tiers_after_threshold() {
        let mut h = RpcPollHealth::new();
        h.failure_streak = RPC_OFFLINE_FAILURE_STREAK;
        assert_eq!(h.backoff_sleep(), Duration::from_millis(BACKOFF_MS[0]));
        h.failure_streak = RPC_OFFLINE_FAILURE_STREAK + 1;
        assert_eq!(h.backoff_sleep(), Duration::from_millis(BACKOFF_MS[1]));
        h.failure_streak = RPC_OFFLINE_FAILURE_STREAK + 2;
        assert_eq!(h.backoff_sleep(), Duration::from_millis(BACKOFF_MS[2]));
        h.failure_streak = RPC_OFFLINE_FAILURE_STREAK + 99;
        assert_eq!(h.backoff_sleep(), Duration::from_millis(BACKOFF_MS[2]));
    }

    #[test]
    fn rate_limit_jumps_to_tier() {
        let mut h = RpcPollHealth::new();
        h.report_rate_limited();
        assert_eq!(h.backoff_sleep(), Duration::from_millis(BACKOFF_MS[0]));
    }
}

// SPDX-License-Identifier: AGPL-3.0-or-later

//! JSON-RPC call counters and rolling-window rates for operator benchmarks ([#306](https://gitlab.com/PlasticDigits/yieldomega/-/issues/306)).

use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::Serialize;

const WINDOW_1M: Duration = Duration::from_secs(60);
const WINDOW_5M: Duration = Duration::from_secs(300);
const BURST_WINDOW: Duration = Duration::from_secs(10);
const RETAIN: Duration = Duration::from_secs(300);

/// Subsystem tag for per-caller breakdown on [`GET /v1/status`](crate::api::status).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RpcCaller {
    Ingestion,
    ChainTimer,
    PodiumLive,
    WarbowScore,
    Reorg,
}

impl RpcCaller {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ingestion => "ingestion",
            Self::ChainTimer => "chain_timer",
            Self::PodiumLive => "podium_live",
            Self::WarbowScore => "warbow_score",
            Self::Reorg => "reorg",
        }
    }
}

/// JSON-RPC method family (aligned with provider surface).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RpcMethod {
    BlockNumber,
    GetBlockByNumber,
    GetLogs,
    EthCall,
}

impl RpcMethod {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::BlockNumber => "eth_blockNumber",
            Self::GetBlockByNumber => "eth_getBlockByNumber",
            Self::GetLogs => "eth_getLogs",
            Self::EthCall => "eth_call",
        }
    }
}

#[derive(Debug, Clone)]
struct RpcEvent {
    at: Instant,
    method: RpcMethod,
    caller: RpcCaller,
}

#[derive(Debug, Default)]
struct RpcMetricsInner {
    events: VecDeque<RpcEvent>,
    total_calls: u64,
}

/// Thread-safe RPC counters shared by ingestion, chain-timer, and ingest-side snapshots.
#[derive(Debug, Clone)]
pub struct RpcMetrics {
    inner: Arc<Mutex<RpcMetricsInner>>,
}

impl Default for RpcMetrics {
    fn default() -> Self {
        Self::new()
    }
}

impl RpcMetrics {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(RpcMetricsInner::default())),
        }
    }

    /// Record one logical JSON-RPC request (not per fallback URL retry).
    pub fn record(&self, method: RpcMethod, caller: RpcCaller) {
        let mut g = self.inner.lock().expect("rpc_metrics mutex");
        let now = Instant::now();
        g.total_calls = g.total_calls.saturating_add(1);
        g.events.push_back(RpcEvent {
            at: now,
            method,
            caller,
        });
        let cutoff = now.checked_sub(RETAIN).unwrap_or(Instant::now());
        while g
            .events
            .front()
            .is_some_and(|e| e.at < cutoff)
        {
            g.events.pop_front();
        }
    }

    pub fn snapshot(&self) -> RpcMetricsSnapshot {
        let g = self.inner.lock().expect("rpc_metrics mutex");
        let now = Instant::now();
        let mut events_5m: Vec<&RpcEvent> = Vec::new();
        let cutoff_5m = now.checked_sub(WINDOW_5M).unwrap_or(now);
        for e in g.events.iter() {
            if e.at >= cutoff_5m {
                events_5m.push(e);
            }
        }

        let count_in = |window: Duration| -> usize {
            let cutoff = now.checked_sub(window).unwrap_or(now);
            events_5m.iter().filter(|e| e.at >= cutoff).count()
        };

        let calls_1m = count_in(WINDOW_1M);
        let calls_5m = events_5m.len();
        let calls_per_min_1m = calls_1m as f64;
        let calls_per_min_5m = if calls_5m > 0 {
            calls_5m as f64 * 60.0 / WINDOW_5M.as_secs() as f64
        } else {
            0.0
        };

        let peak_calls_10s = peak_in_window(&events_5m, BURST_WINDOW);

        let mut by_method: HashMap<String, u64> = HashMap::new();
        let mut by_caller: HashMap<String, u64> = HashMap::new();
        let mut by_method_caller: HashMap<String, u64> = HashMap::new();
        for e in &events_5m {
            *by_method.entry(e.method.as_str().to_string()).or_default() += 1;
            *by_caller.entry(e.caller.as_str().to_string()).or_default() += 1;
            let key = format!("{}:{}", e.method.as_str(), e.caller.as_str());
            *by_method_caller.entry(key).or_default() += 1;
        }

        RpcMetricsSnapshot {
            total_calls: g.total_calls,
            calls_last_1m: calls_1m as u64,
            calls_last_5m: calls_5m as u64,
            calls_per_min_1m,
            calls_per_min_5m,
            peak_calls_10s,
            by_method,
            by_caller,
            by_method_caller,
        }
    }
}

fn peak_in_window(events: &[&RpcEvent], window: Duration) -> u32 {
    if events.is_empty() {
        return 0;
    }
    let mut peak = 0u32;
    for (i, start) in events.iter().enumerate() {
        let end = start.at + window;
        let mut count = 0u32;
        for e in events.iter().skip(i) {
            if e.at > end {
                break;
            }
            count = count.saturating_add(1);
        }
        peak = peak.max(count);
    }
    peak
}

#[derive(Debug, Clone, Serialize)]
pub struct RpcMetricsSnapshot {
    pub total_calls: u64,
    pub calls_last_1m: u64,
    pub calls_last_5m: u64,
    pub calls_per_min_1m: f64,
    pub calls_per_min_5m: f64,
    pub peak_calls_10s: u32,
    pub by_method: HashMap<String, u64>,
    pub by_caller: HashMap<String, u64>,
    pub by_method_caller: HashMap<String, u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rolling_rates_and_burst() {
        let m = RpcMetrics::new();
        for _ in 0..30 {
            m.record(RpcMethod::EthCall, RpcCaller::ChainTimer);
        }
        let s = m.snapshot();
        assert_eq!(s.calls_last_1m, 30);
        assert!((s.calls_per_min_1m - 30.0).abs() < 0.01);
        assert_eq!(s.peak_calls_10s, 30);
        assert_eq!(s.by_method.get("eth_call"), Some(&30));
        assert_eq!(s.by_caller.get("chain_timer"), Some(&30));
    }

    #[test]
    fn method_caller_keys() {
        let m = RpcMetrics::new();
        m.record(RpcMethod::GetLogs, RpcCaller::Ingestion);
        m.record(RpcMethod::GetBlockByNumber, RpcCaller::Ingestion);
        let s = m.snapshot();
        assert_eq!(
            s.by_method_caller.get("eth_getLogs:ingestion"),
            Some(&1)
        );
    }
}

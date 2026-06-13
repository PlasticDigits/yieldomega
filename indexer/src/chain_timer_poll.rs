// SPDX-License-Identifier: AGPL-3.0-or-later

//! Adaptive chain-timer poll spacing when head state is stable ([#308](https://gitlab.com/PlasticDigits/yieldomega/-/issues/308)).

use std::time::Duration;

use crate::chain_timer::TimecurveHeadSnapshot;
use crate::rpc_poll_health::{RpcPollHealth, RPC_FAST_POLL_MS, RPC_OFFLINE_FAILURE_STREAK};

/// Default idle cadence — keeps `GET /v1/arena/timers` `polled_at_ms` within the 3s SLO.
pub const DEFAULT_CHAIN_TIMER_IDLE_POLL_MS: u64 = 3000;

/// Wall-clock margin before global / podium deadlines to switch back to fast polls.
pub const DEFAULT_CHAIN_TIMER_DEADLINE_PROXIMITY_SEC: u64 = 30;

/// Hard cap on idle spacing so timer freshness SLO (3s) is never violated.
pub const MAX_CHAIN_TIMER_IDLE_POLL_MS: u64 = 3000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChainTimerPollMode {
    Fast,
    Idle,
}

impl ChainTimerPollMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Fast => "fast",
            Self::Idle => "idle",
        }
    }
}

/// `CHAIN_TIMER_IDLE_POLL_MS` — slower cadence when head epochs are stable (default **3000** ms, clamped to **[`RPC_FAST_POLL_MS`], [`MAX_CHAIN_TIMER_IDLE_POLL_MS`**]).
pub fn idle_poll_ms_from_env() -> u64 {
    std::env::var("CHAIN_TIMER_IDLE_POLL_MS")
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map(|ms| ms.clamp(RPC_FAST_POLL_MS, MAX_CHAIN_TIMER_IDLE_POLL_MS))
        .unwrap_or(DEFAULT_CHAIN_TIMER_IDLE_POLL_MS)
}

/// `CHAIN_TIMER_DEADLINE_PROXIMITY_SEC` — fast polls when any deadline is within this many seconds (default **30**).
pub fn deadline_proximity_sec_from_env() -> u64 {
    std::env::var("CHAIN_TIMER_DEADLINE_PROXIMITY_SEC")
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .unwrap_or(DEFAULT_CHAIN_TIMER_DEADLINE_PROXIMITY_SEC)
}

fn parse_u64_decimal(s: &str) -> Option<u64> {
    s.trim().parse::<u64>().ok()
}

fn is_deadline_within_margin(deadline_sec: u64, now_wall_sec: u64, margin_sec: u64) -> bool {
    if deadline_sec == 0 {
        return false;
    }
    deadline_sec.saturating_sub(now_wall_sec) <= margin_sec
}

fn any_deadline_near(timer: &crate::chain_timer::ChainTimerSnapshot, now_wall_sec: u64, margin_sec: u64) -> bool {
    if let Some(dl) = parse_u64_decimal(&timer.deadline_sec) {
        if is_deadline_within_margin(dl, now_wall_sec, margin_sec) {
            return true;
        }
    }
    timer.podium_deadlines_sec.iter().any(|s| {
        parse_u64_decimal(s)
            .is_some_and(|dl| is_deadline_within_margin(dl, now_wall_sec, margin_sec))
    })
}

/// Whether adaptive head fields differ between snapshots (block, epochs, onchain deadlines).
pub fn head_adaptive_fields_changed(
    previous: &TimecurveHeadSnapshot,
    current: &TimecurveHeadSnapshot,
) -> bool {
    let p = &previous.timer;
    let c = &current.timer;
    p.read_block_number != c.read_block_number
        || p.last_buy_epoch != c.last_buy_epoch
        || p.podium_epochs != c.podium_epochs
        || p.deadline_sec != c.deadline_sec
        || p.podium_deadlines_sec != c.podium_deadlines_sec
}

/// Select fast vs idle spacing after a successful `poll_once`.
pub fn chain_timer_poll_mode(
    previous: Option<&TimecurveHeadSnapshot>,
    current: &TimecurveHeadSnapshot,
    now_wall_sec: u64,
    deadline_proximity_sec: u64,
) -> ChainTimerPollMode {
    if let Some(prev) = previous {
        if head_adaptive_fields_changed(prev, current) {
            return ChainTimerPollMode::Fast;
        }
    } else {
        return ChainTimerPollMode::Fast;
    }

    if any_deadline_near(&current.timer, now_wall_sec, deadline_proximity_sec) {
        return ChainTimerPollMode::Fast;
    }

    ChainTimerPollMode::Idle
}

/// Whether the next cycle can use a lightweight head check instead of full `poll_once`.
pub fn idle_short_circuit_applicable(
    health: &RpcPollHealth,
    previous: Option<&TimecurveHeadSnapshot>,
    now_wall_sec: u64,
    deadline_proximity_sec: u64,
) -> bool {
    let Some(prev) = previous else {
        return false;
    };
    if health.failure_streak() > 0 {
        return false;
    }
    chain_timer_poll_mode(Some(prev), prev, now_wall_sec, deadline_proximity_sec)
        == ChainTimerPollMode::Idle
}

pub fn head_block_number_unchanged(previous: &TimecurveHeadSnapshot, head_block: u64) -> bool {
    previous
        .timer
        .read_block_number
        .parse::<u64>()
        .ok()
        .is_some_and(|cached| cached == head_block)
}

/// Refresh wall-clock freshness on a cached snapshot (idle short-circuit path).
pub fn refresh_snapshot_polled_at_ms(snap: &mut TimecurveHeadSnapshot) {
    let polled_at_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    snap.timer.polled_at_ms = polled_at_ms;
    snap.sale_state.polled_at_ms = polled_at_ms;
}

pub fn chain_timer_sleep_after_cycle(
    health: &RpcPollHealth,
    poll_succeeded: bool,
    mode: ChainTimerPollMode,
    idle_poll_ms: u64,
) -> Duration {
    if !poll_succeeded || health.failure_streak() >= RPC_OFFLINE_FAILURE_STREAK {
        return health.backoff_sleep();
    }
    match mode {
        ChainTimerPollMode::Fast => Duration::from_millis(RPC_FAST_POLL_MS),
        ChainTimerPollMode::Idle => Duration::from_millis(idle_poll_ms),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::chain_timer::{
        ArenaSaleHeadFields, ChainTimerSnapshot, PodiumRpcRow, TimecurveHeadSnapshot,
    };
    use crate::sale_state::TimecurveSaleStateSnapshot;

    fn minimal_snapshot(
        block: &str,
        last_buy_epoch: &str,
        podium_epochs: [String; 4],
        deadline_sec: &str,
        podium_deadlines_sec: [String; 4],
    ) -> TimecurveHeadSnapshot {
        TimecurveHeadSnapshot {
            timer: ChainTimerSnapshot {
                sale_start_sec: "0".into(),
                deadline_sec: deadline_sec.into(),
                block_timestamp_sec: "0".into(),
                timer_cap_sec: "0".into(),
                read_block_number: block.into(),
                polled_at_ms: 0,
                last_buy_epoch: last_buy_epoch.into(),
                podium_epochs,
                podium_deadlines_sec,
            },
            sale_ended: false,
            podium_contract: std::array::from_fn(|_| PodiumRpcRow {
                winners: std::array::from_fn(|_| "0x0".into()),
                values: std::array::from_fn(|_| "0".into()),
            }),
            active_pool_balance_doub_wad: std::array::from_fn(|_| "0".into()),
            sale_state: TimecurveSaleStateSnapshot {
                read_block_number: block.into(),
                block_timestamp_sec: "0".into(),
                polled_at_ms: 0,
                deadline_sec: deadline_sec.into(),
                total_doub_raised: "0".into(),
                paused: false,
            },
            sale_head: ArenaSaleHeadFields {
                charm_price_wad: "0".into(),
                epoch_charm_anchor_wad: "0".into(),
                epoch_anchor_timestamp_sec: "0".into(),
                doub: "0x0".into(),
                referral_registry: "0x0".into(),
                buy_cooldown_sec: "0".into(),
                timer_extension_sec: "0".into(),
                time_arena_buy_router: "0x0".into(),
                referral_cred_flat_wad: "0".into(),
            },
        }
    }

    fn stable_snapshot() -> TimecurveHeadSnapshot {
        minimal_snapshot(
            "100",
            "5",
            std::array::from_fn(|i| (i as u64).to_string()),
            "9_999_999",
            std::array::from_fn(|i| (9_999_990u64 + i as u64).to_string()),
        )
    }

    #[test]
    fn first_poll_is_fast() {
        let cur = stable_snapshot();
        assert_eq!(
            chain_timer_poll_mode(None, &cur, 1_000, 30),
            ChainTimerPollMode::Fast
        );
    }

    #[test]
    fn unchanged_head_is_idle() {
        let prev = stable_snapshot();
        let cur = stable_snapshot();
        assert_eq!(
            chain_timer_poll_mode(Some(&prev), &cur, 1_000, 30),
            ChainTimerPollMode::Idle
        );
    }

    #[test]
    fn block_advance_is_fast() {
        let prev = stable_snapshot();
        let mut cur = stable_snapshot();
        cur.timer.read_block_number = "101".into();
        assert_eq!(
            chain_timer_poll_mode(Some(&prev), &cur, 1_000, 30),
            ChainTimerPollMode::Fast
        );
    }

    #[test]
    fn epoch_change_is_fast() {
        let prev = stable_snapshot();
        let mut cur = stable_snapshot();
        cur.timer.last_buy_epoch = "6".into();
        assert_eq!(
            chain_timer_poll_mode(Some(&prev), &cur, 1_000, 30),
            ChainTimerPollMode::Fast
        );
    }

    #[test]
    fn podium_epoch_change_is_fast() {
        let prev = stable_snapshot();
        let mut cur = stable_snapshot();
        cur.timer.podium_epochs[2] = "99".into();
        assert_eq!(
            chain_timer_poll_mode(Some(&prev), &cur, 1_000, 30),
            ChainTimerPollMode::Fast
        );
    }

    #[test]
    fn global_deadline_proximity_is_fast() {
        let prev = stable_snapshot();
        let cur = minimal_snapshot(
            "100",
            "5",
            std::array::from_fn(|i| (i as u64).to_string()),
            "1_030",
            std::array::from_fn(|_| "9_999_999".into()),
        );
        assert_eq!(
            chain_timer_poll_mode(Some(&prev), &cur, 1_000, 30),
            ChainTimerPollMode::Fast
        );
    }

    #[test]
    fn podium_deadline_proximity_is_fast() {
        let prev = stable_snapshot();
        let cur = minimal_snapshot(
            "100",
            "5",
            std::array::from_fn(|i| (i as u64).to_string()),
            "9_999_999",
            [
                "9_999_999".into(),
                "9_999_999".into(),
                "1_015".into(),
                "9_999_999".into(),
            ],
        );
        assert_eq!(
            chain_timer_poll_mode(Some(&prev), &cur, 1_000, 30),
            ChainTimerPollMode::Fast
        );
    }

    #[test]
    fn deadline_past_stays_fast_within_margin() {
        let prev = stable_snapshot();
        let cur = minimal_snapshot(
            "100",
            "5",
            std::array::from_fn(|i| (i as u64).to_string()),
            "500",
            std::array::from_fn(|_| "9_999_999".into()),
        );
        assert_eq!(
            chain_timer_poll_mode(Some(&prev), &cur, 1_000, 30),
            ChainTimerPollMode::Fast
        );
    }

    #[test]
    fn idle_short_circuit_when_stable_head() {
        let prev = stable_snapshot();
        let h = RpcPollHealth::new();
        assert!(idle_short_circuit_applicable(
            &h,
            Some(&prev),
            1_000,
            30,
        ));
    }

    #[test]
    fn idle_short_circuit_disabled_near_deadline() {
        let prev = stable_snapshot();
        let h = RpcPollHealth::new();
        assert!(!idle_short_circuit_applicable(
            &h,
            Some(&prev),
            9_999_980,
            30,
        ));
    }

    #[test]
    fn head_block_number_unchanged_matches() {
        let prev = stable_snapshot();
        assert!(head_block_number_unchanged(&prev, 100));
        assert!(!head_block_number_unchanged(&prev, 101));
    }

    #[test]
    fn refresh_snapshot_polled_at_ms_updates_fields() {
        let mut snap = stable_snapshot();
        snap.timer.polled_at_ms = 1;
        snap.sale_state.polled_at_ms = 1;
        refresh_snapshot_polled_at_ms(&mut snap);
        assert!(snap.timer.polled_at_ms > 1);
        assert_eq!(snap.timer.polled_at_ms, snap.sale_state.polled_at_ms);
    }

    #[test]
    fn failure_backoff_unchanged_on_error() {
        let mut h = RpcPollHealth::new();
        h.report_rate_limited();
        let sleep = chain_timer_sleep_after_cycle(
            &h,
            false,
            ChainTimerPollMode::Idle,
            DEFAULT_CHAIN_TIMER_IDLE_POLL_MS,
        );
        assert_eq!(sleep, h.backoff_sleep());
        assert_eq!(sleep, Duration::from_millis(5_000));
    }

    #[test]
    fn rate_limit_overrides_idle_on_success() {
        let mut h = RpcPollHealth::new();
        h.report_rate_limited();
        let sleep = chain_timer_sleep_after_cycle(
            &h,
            true,
            ChainTimerPollMode::Idle,
            DEFAULT_CHAIN_TIMER_IDLE_POLL_MS,
        );
        assert_eq!(sleep, Duration::from_millis(5_000));
    }

    #[test]
    fn healthy_idle_uses_configured_ms() {
        let h = RpcPollHealth::new();
        let sleep = chain_timer_sleep_after_cycle(
            &h,
            true,
            ChainTimerPollMode::Idle,
            2_500,
        );
        assert_eq!(sleep, Duration::from_millis(2_500));
    }

    #[test]
    fn healthy_fast_uses_rpc_fast_poll_ms() {
        let h = RpcPollHealth::new();
        let sleep = chain_timer_sleep_after_cycle(&h, true, ChainTimerPollMode::Fast, 3_000);
        assert_eq!(sleep, Duration::from_millis(RPC_FAST_POLL_MS));
    }

    #[test]
    fn idle_poll_ms_env_clamped_to_slo_max() {
        std::env::set_var("CHAIN_TIMER_IDLE_POLL_MS", "99999");
        assert_eq!(idle_poll_ms_from_env(), MAX_CHAIN_TIMER_IDLE_POLL_MS);
        std::env::remove_var("CHAIN_TIMER_IDLE_POLL_MS");
    }
}

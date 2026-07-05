// SPDX-License-Identifier: AGPL-3.0-or-later

//! Podium epoch semantics for indexer HTTP responses.
//!
//! `PodiumEpochRolled` emits the **post-increment** head `podiumEpoch[cat]` (the epoch
//! players compete in after settlement). Winners competed in the **settled** epoch
//! `max(event_epoch - 1, 0)` — same mapping as `bots/announcer/announce.py`.

/// Settled competition epoch from a stored `PodiumEpochRolled` event epoch.
pub fn settled_epoch_from_roll_event(epoch: u64) -> u64 {
    epoch.saturating_sub(1)
}

/// Decimal string form for JSON API fields.
pub fn settled_epoch_str_from_roll_event(epoch: &str) -> String {
    let raw = epoch.parse::<u64>().unwrap_or(0);
    settled_epoch_from_roll_event(raw).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settled_epoch_subtracts_one() {
        assert_eq!(settled_epoch_from_roll_event(0), 0);
        assert_eq!(settled_epoch_from_roll_event(1), 0);
        assert_eq!(settled_epoch_from_roll_event(3), 2);
    }

    #[test]
    fn settled_epoch_str_parses_decimal() {
        assert_eq!(settled_epoch_str_from_roll_event("3"), "2");
        assert_eq!(settled_epoch_str_from_roll_event("not-a-number"), "0");
    }
}

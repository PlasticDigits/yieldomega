// SPDX-License-Identifier: AGPL-3.0-or-later

//! Aggregated DOUB buy routing for `GET /v1/arena/podiums` ([#300](https://gitlab.com/PlasticDigits/yieldomega/-/issues/300)).

use alloy_primitives::U256;
use serde_json::json;

use crate::arena_podium_prize;

/// Per-category share of each buy (`ArenaBuyRouting.PODIUM_SHARE_BPS`).
const PODIUM_CATEGORY_SHARE_BPS: u64 = 2500;
const TRANCHE_CURRENT_BPS: u64 = 7000;
const TRANCHE_NEXT_BPS: u64 = 2000;
const TRANCHE_FUTURE_BPS: u64 = 1000;

fn sum_pool_arrays(pools: &[String; 4]) -> U256 {
    pools.iter().fold(U256::ZERO, |acc, s| {
        acc + s.parse::<U256>().unwrap_or(U256::ZERO)
    })
}

fn tranche_json(slot: &str, tranche_bps: u64, pool_total: U256) -> serde_json::Value {
    json!({
        "slot": slot,
        "tranche_bps": tranche_bps,
        "pool_total_doub_wad": pool_total.to_string(),
        "prize_places_doub_wad": arena_podium_prize::prize_places_wad_strings(pool_total),
    })
}

/// Head snapshot totals across four podium categories — 70/20/10 epoch tranches at `read_block_number`.
pub fn podiums_buy_routing_json(
    active: &[String; 4],
    seed: &[String; 4],
    future: &[String; 4],
) -> serde_json::Value {
    json!({
        "podium_category_share_bps": PODIUM_CATEGORY_SHARE_BPS,
        "admin_share_bps": 0,
        "epoch_tranches": [
            tranche_json("current", TRANCHE_CURRENT_BPS, sum_pool_arrays(active)),
            tranche_json("next", TRANCHE_NEXT_BPS, sum_pool_arrays(seed)),
            tranche_json("future", TRANCHE_FUTURE_BPS, sum_pool_arrays(future)),
        ],
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buy_routing_sums_pools_and_prizes() {
        let j = podiums_buy_routing_json(
            &["700".into(), "0".into(), "1400".into(), "350".into()],
            &["200".into(), "0".into(), "400".into(), "100".into()],
            &["100".into(), "0".into(), "200".into(), "50".into()],
        );
        let tranches = j["epoch_tranches"].as_array().unwrap();
        assert_eq!(tranches.len(), 3);
        assert_eq!(tranches[0]["pool_total_doub_wad"], "2450");
        let prizes = tranches[0]["prize_places_doub_wad"].as_array().unwrap();
        assert_eq!(prizes[0], "1400");
        assert_eq!(prizes[1], "700");
        assert_eq!(prizes[2], "350");
    }
}

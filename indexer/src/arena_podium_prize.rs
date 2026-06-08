// SPDX-License-Identifier: AGPL-3.0-or-later

//! Active-epoch podium prize preview math — mirrors `ArenaPodiumSettlement.payoutShares` ([#302](https://gitlab.com/PlasticDigits/yieldomega/-/issues/302)).

use alloy_primitives::U256;

const WEIGHT_FIRST: U256 = U256::from_limbs([4, 0, 0, 0]);
const WEIGHT_SECOND: U256 = U256::from_limbs([2, 0, 0, 0]);
const WEIGHT_SUM: U256 = U256::from_limbs([7, 0, 0, 0]);

/// 4∶2∶1 split of `pool` (floor mulDiv, same as onchain settlement).
pub fn payout_shares(pool: U256) -> (U256, U256, U256) {
    if pool.is_zero() {
        return (U256::ZERO, U256::ZERO, U256::ZERO);
    }
    let first = pool * WEIGHT_FIRST / WEIGHT_SUM;
    let second = pool * WEIGHT_SECOND / WEIGHT_SUM;
    let third = pool - first - second;
    (first, second, third)
}

pub fn prize_places_wad_strings(pool: U256) -> [String; 3] {
    let (first, second, third) = payout_shares(pool);
    [first.to_string(), second.to_string(), third.to_string()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payout_shares_sum_equals_pool() {
        for pool in [0u128, 1, 7, 100, 700, 1_000_000, u128::MAX / 8] {
            let pool_u256 = U256::from(pool);
            let (a, b, c) = payout_shares(pool_u256);
            assert_eq!(a + b + c, pool_u256, "pool={pool}");
        }
    }

    #[test]
    fn payout_shares_worked_example() {
        let (a, b, c) = payout_shares(U256::from(700u64));
        assert_eq!(a, U256::from(400u64));
        assert_eq!(b, U256::from(200u64));
        assert_eq!(c, U256::from(100u64));
    }
}

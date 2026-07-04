// SPDX-License-Identifier: AGPL-3.0-or-later

//! Running global Last Buy epoch head for ordered log ingest ([#278](https://gitlab.com/PlasticDigits/yieldomega/-/issues/278)).

use alloy_primitives::U256;
use eyre::Result;
use sqlx::postgres::PgConnection;

/// Global `TimeArena.lastBuyEpoch` at the current log position during block ingest.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LastBuyEpochHead {
    pub epoch: u64,
}

impl LastBuyEpochHead {
    pub const INITIAL: Self = Self { epoch: 0 };

    pub fn new(epoch: u64) -> Self {
        Self { epoch }
    }

    /// Load the latest persisted epoch start (defaults to **0** before any Last Buy podium roll).
    pub async fn load(conn: &mut PgConnection) -> Result<Self> {
        let row: Option<(i64,)> = sqlx::query_as(
            r#"SELECT COALESCE(MAX(epoch), 0)::bigint FROM idx_arena_last_buy_epoch_started"#,
        )
        .fetch_optional(&mut *conn)
        .await?;
        Ok(Self {
            epoch: row.map(|(e,)| e as u64).unwrap_or(0),
        })
    }

    pub fn apply_epoch_started(&mut self, epoch: U256) {
        self.epoch = u256_to_u64(epoch);
    }

    pub fn epoch_for_buy(&self) -> i64 {
        self.epoch as i64
    }
}

fn u256_to_u64(n: U256) -> u64 {
    n.to::<u64>()
}

#[cfg(test)]
mod tests {
    use super::*;
    use alloy_primitives::U256;

    #[test]
    fn head_starts_at_zero() {
        assert_eq!(LastBuyEpochHead::INITIAL.epoch, 0);
    }

    #[test]
    fn apply_epoch_started_updates_head() {
        let mut head = LastBuyEpochHead::INITIAL;
        head.apply_epoch_started(U256::from(3u64));
        assert_eq!(head.epoch, 3);
        assert_eq!(head.epoch_for_buy(), 3);
    }
}

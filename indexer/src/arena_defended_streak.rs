// SPDX-License-Identifier: AGPL-3.0-or-later

//! Defended Streak ingest replay mirroring `TimeArena._processDefendedStreak` ([#366](https://gitlab.com/PlasticDigits/yieldomega/-/issues/366)).

use eyre::Result;
use sqlx::postgres::PgConnection;
use sqlx::{PgPool, Row};

pub const DEFENDED_STREAK_WINDOW_SEC: i64 = 900;
pub const DEFENDED_STREAK_MIN_LEVEL: u64 = 3;
const CAT_DEFENDED_STREAK: i16 = 2;

#[derive(Debug, Clone, Default)]
pub struct DefendedStreakHolderState {
    pub holder: Option<String>,
    pub holder_active: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BuyStreakSnapshot {
    pub active: u64,
    pub best: u64,
}

#[derive(Debug, Clone)]
struct ReplayBuy {
    buyer: String,
    actual_seconds_added: u128,
    new_deadline: u128,
    block_timestamp_sec: i64,
    block_number: i64,
    log_index: i32,
    tx_hash: String,
    gate_level: u64,
}

#[derive(Debug, Clone)]
enum ReplayEvent {
    Buy(ReplayBuy),
    EpochReset { block_number: i64, log_index: i32 },
}

fn remaining_before_sec(
    new_deadline: u128,
    actual_seconds_added: u128,
    block_timestamp_sec: i64,
) -> i64 {
    let deadline_before = if actual_seconds_added > 0 {
        new_deadline.saturating_sub(actual_seconds_added)
    } else {
        new_deadline
    };
    if deadline_before <= block_timestamp_sec as u128 {
        return 0;
    }
    (deadline_before - block_timestamp_sec as u128) as i64
}

fn parse_u128(s: &str) -> u128 {
    s.parse().unwrap_or(0)
}

fn parse_u64(s: &str) -> u64 {
    s.parse().unwrap_or(0)
}

/// Mirrors `TimeArena._processDefendedStreak` for a single gated buy.
pub fn process_defended_streak_buy(
    state: &mut DefendedStreakHolderState,
    wallet_best: &mut std::collections::HashMap<String, u64>,
    buyer: &str,
    gate_level: u64,
    remaining_before: i64,
    seconds_added: u128,
) -> BuyStreakSnapshot {
    let buyer_lc = buyer.to_ascii_lowercase();
    let prior_best = *wallet_best.get(&buyer_lc).unwrap_or(&0);

    if gate_level < DEFENDED_STREAK_MIN_LEVEL {
        return BuyStreakSnapshot {
            active: 0,
            best: prior_best,
        };
    }

    if remaining_before < DEFENDED_STREAK_WINDOW_SEC && seconds_added > 0 {
        let active = if state
            .holder
            .as_ref()
            .is_some_and(|h| h.eq_ignore_ascii_case(buyer))
        {
            state.holder_active.saturating_add(1)
        } else {
            1
        };
        state.holder = Some(buyer.to_string());
        state.holder_active = active;

        let best = prior_best.max(active);
        wallet_best.insert(buyer_lc, best);
        BuyStreakSnapshot { active, best }
    } else if remaining_before >= DEFENDED_STREAK_WINDOW_SEC {
        if state.holder.is_some() {
            state.holder = None;
            state.holder_active = 0;
        }
        BuyStreakSnapshot {
            active: 0,
            best: prior_best,
        }
    } else {
        BuyStreakSnapshot {
            active: 0,
            best: prior_best,
        }
    }
}

pub fn clear_defended_streak_holder(state: &mut DefendedStreakHolderState) {
    state.holder = None;
    state.holder_active = 0;
}

async fn gate_level_for_buy_tx(
    conn: &mut PgConnection,
    tx_hash: &str,
    buyer: &str,
    charm_wad: u128,
) -> Result<u64, sqlx::Error> {
    if let Some(level) = sqlx::query_scalar::<_, String>(
        r#"SELECT new_level::text
           FROM idx_player_xp
           WHERE tx_hash = $1 AND lower(player) = lower($2)
           ORDER BY log_index DESC
           LIMIT 1"#,
    )
    .bind(tx_hash)
    .bind(buyer)
    .fetch_optional(&mut *conn)
    .await?
    {
        return Ok(parse_u64(&level).max(1));
    }

    crate::arena_wallet_stats::gate_level_after_charm_wad(conn, buyer, charm_wad).await
}

#[derive(Debug, Clone)]
pub struct DefendedStreakBuyInput {
    pub tx_hash: String,
    pub log_index: i32,
    pub buyer: String,
    pub charm_wad: u128,
    pub new_deadline: u128,
    pub actual_seconds_added: u128,
    pub block_timestamp_sec: Option<i64>,
}

pub async fn apply_defended_streak_after_buy(
    conn: &mut PgConnection,
    input: &DefendedStreakBuyInput,
) -> Result<BuyStreakSnapshot, sqlx::Error> {
    let gate_level = gate_level_for_buy_tx(
        conn,
        &input.tx_hash,
        &input.buyer,
        input.charm_wad,
    )
    .await?;
    let block_ts = input.block_timestamp_sec.unwrap_or(0);
    let remaining = remaining_before_sec(
        input.new_deadline,
        input.actual_seconds_added,
        block_ts,
    );

    let mut state = load_holder_state_conn(conn).await?;
    let mut wallet_best = std::collections::HashMap::new();
    if let Some(best) = sqlx::query_scalar::<_, Option<String>>(
        r#"SELECT buyer_best_defended_streak::text
           FROM idx_arena_buy
           WHERE lower(buyer) = lower($1)
             AND buyer_best_defended_streak IS NOT NULL
           ORDER BY block_number DESC, log_index DESC
           LIMIT 1"#,
    )
    .bind(&input.buyer)
    .fetch_optional(&mut *conn)
    .await?
    .flatten()
    {
        wallet_best.insert(input.buyer.to_ascii_lowercase(), parse_u64(&best));
    }

    let snapshot = process_defended_streak_buy(
        &mut state,
        &mut wallet_best,
        &input.buyer,
        gate_level,
        remaining,
        input.actual_seconds_added,
    );

    sqlx::query(
        r#"UPDATE idx_arena_buy
           SET buyer_active_defended_streak = $1::numeric,
               buyer_best_defended_streak = $2::numeric
           WHERE tx_hash = $3 AND log_index = $4"#,
    )
    .bind(snapshot.active.to_string())
    .bind(snapshot.best.to_string())
    .bind(&input.tx_hash)
    .bind(input.log_index)
    .execute(&mut *conn)
    .await?;

    save_holder_state_conn(conn, &state).await?;
    Ok(snapshot)
}

pub async fn clear_holder_on_defended_epoch_roll(conn: &mut PgConnection) -> Result<(), sqlx::Error> {
    let mut state = load_holder_state_conn(conn).await?;
    clear_defended_streak_holder(&mut state);
    save_holder_state_conn(conn, &state).await
}

async fn load_holder_state_conn(conn: &mut PgConnection) -> Result<DefendedStreakHolderState, sqlx::Error> {
    let row = sqlx::query(
        r#"SELECT holder_address, holder_active::text AS holder_active
           FROM idx_arena_defended_streak_state
           WHERE id = 1"#,
    )
    .fetch_one(&mut *conn)
    .await?;
    let holder: Option<String> = row.try_get("holder_address").ok();
    let holder_active = parse_u64(&row.get::<String, _>("holder_active"));
    Ok(DefendedStreakHolderState {
        holder,
        holder_active,
    })
}

async fn save_holder_state_conn(
    conn: &mut PgConnection,
    state: &DefendedStreakHolderState,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE idx_arena_defended_streak_state
           SET holder_address = $1, holder_active = $2::numeric
           WHERE id = 1"#,
    )
    .bind(state.holder.as_deref())
    .bind(state.holder_active.to_string())
    .execute(&mut *conn)
    .await?;
    Ok(())
}

pub async fn backfill_if_needed(pool: &PgPool) -> Result<()> {
    let complete: bool = sqlx::query_scalar(
        r#"SELECT backfill_complete FROM idx_arena_defended_streak_state WHERE id = 1"#,
    )
    .fetch_one(pool)
    .await?;

    if complete {
        return Ok(());
    }

    tracing::info!("backfilling defended streak columns on idx_arena_buy");
    let mut conn = pool.acquire().await?;

    let buy_rows = sqlx::query(
        r#"SELECT buyer, charm_wad::text, actual_seconds_added::text, new_deadline::text,
                  EXTRACT(EPOCH FROM block_timestamp)::bigint AS block_ts,
                  block_number, log_index, tx_hash
           FROM idx_arena_buy
           ORDER BY block_number, log_index"#,
    )
    .fetch_all(&mut *conn)
    .await?;

    let roll_rows = sqlx::query(
        r#"SELECT block_number, log_index
           FROM idx_arena_podium_epoch
           WHERE category = $1
           ORDER BY block_number, log_index"#,
    )
    .bind(CAT_DEFENDED_STREAK)
    .fetch_all(&mut *conn)
    .await?;

    let mut events: Vec<ReplayEvent> = Vec::with_capacity(buy_rows.len() + roll_rows.len());
    for r in buy_rows {
        let charm_wad = parse_u128(&r.get::<String, _>("charm_wad"));
        let gate_level =
            gate_level_for_buy_tx(&mut conn, &r.get::<String, _>("tx_hash"), &r.get::<String, _>("buyer"), charm_wad)
                .await?;
        events.push(ReplayEvent::Buy(ReplayBuy {
            buyer: r.get("buyer"),
            actual_seconds_added: parse_u128(&r.get::<String, _>("actual_seconds_added")),
            new_deadline: parse_u128(&r.get::<String, _>("new_deadline")),
            block_timestamp_sec: r.get::<Option<i64>, _>("block_ts").unwrap_or(0),
            block_number: r.get("block_number"),
            log_index: r.get("log_index"),
            tx_hash: r.get("tx_hash"),
            gate_level,
        }));
    }
    for r in roll_rows {
        events.push(ReplayEvent::EpochReset {
            block_number: r.get("block_number"),
            log_index: r.get("log_index"),
        });
    }

    events.sort_by_key(|e| match e {
        ReplayEvent::Buy(b) => (b.block_number, b.log_index, 0),
        ReplayEvent::EpochReset {
            block_number,
            log_index,
        } => (*block_number, *log_index, 1),
    });

    let mut state = DefendedStreakHolderState::default();
    let mut wallet_best: std::collections::HashMap<String, u64> = std::collections::HashMap::new();

    for event in events {
        match event {
            ReplayEvent::EpochReset { .. } => {
                clear_defended_streak_holder(&mut state);
            }
            ReplayEvent::Buy(buy) => {
                let remaining = remaining_before_sec(
                    buy.new_deadline,
                    buy.actual_seconds_added,
                    buy.block_timestamp_sec,
                );
                let snapshot = process_defended_streak_buy(
                    &mut state,
                    &mut wallet_best,
                    &buy.buyer,
                    buy.gate_level,
                    remaining,
                    buy.actual_seconds_added,
                );
                sqlx::query(
                    r#"UPDATE idx_arena_buy
                       SET buyer_active_defended_streak = $1::numeric,
                           buyer_best_defended_streak = $2::numeric
                       WHERE tx_hash = $3 AND log_index = $4"#,
                )
                .bind(snapshot.active.to_string())
                .bind(snapshot.best.to_string())
                .bind(&buy.tx_hash)
                .bind(buy.log_index)
                .execute(&mut *conn)
                .await?;
            }
        }
    }

    save_holder_state_conn(&mut conn, &state).await?;
    sqlx::query(
        r#"UPDATE idx_arena_defended_streak_state SET backfill_complete = TRUE WHERE id = 1"#,
    )
    .execute(&mut *conn)
    .await?;
    tracing::info!("defended streak backfill complete");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn continue_streak_same_holder() {
        let mut state = DefendedStreakHolderState {
            holder: Some("0xA".into()),
            holder_active: 1,
        };
        let mut bests = std::collections::HashMap::new();
        let snap = process_defended_streak_buy(
            &mut state,
            &mut bests,
            "0xA",
            5,
            100,
            120,
        );
        assert_eq!(snap.active, 2);
        assert_eq!(snap.best, 2);
    }

    #[test]
    fn start_streak_new_holder() {
        let mut state = DefendedStreakHolderState::default();
        let mut bests = std::collections::HashMap::new();
        let snap = process_defended_streak_buy(
            &mut state,
            &mut bests,
            "0xB",
            5,
            200,
            60,
        );
        assert_eq!(snap.active, 1);
        assert_eq!(snap.best, 1);
    }

    #[test]
    fn gate_below_three_is_noop() {
        let mut state = DefendedStreakHolderState::default();
        let mut bests = std::collections::HashMap::new();
        bests.insert("0xA".to_ascii_lowercase(), 4);
        let snap = process_defended_streak_buy(
            &mut state,
            &mut bests,
            "0xA",
            2,
            100,
            120,
        );
        assert_eq!(snap.active, 0);
        assert_eq!(snap.best, 4);
        assert!(state.holder.is_none());
    }

    #[test]
    fn above_window_clears_holder() {
        let mut state = DefendedStreakHolderState {
            holder: Some("0xA".into()),
            holder_active: 3,
        };
        let mut bests = std::collections::HashMap::new();
        let snap = process_defended_streak_buy(
            &mut state,
            &mut bests,
            "0xB",
            5,
            1000,
            120,
        );
        assert_eq!(snap.active, 0);
        assert!(state.holder.is_none());
        assert_eq!(state.holder_active, 0);
    }

    #[test]
    fn epoch_roll_clears_holder_state() {
        let mut state = DefendedStreakHolderState {
            holder: Some("0xA".into()),
            holder_active: 4,
        };
        clear_defended_streak_holder(&mut state);
        assert!(state.holder.is_none());
        assert_eq!(state.holder_active, 0);
    }
}

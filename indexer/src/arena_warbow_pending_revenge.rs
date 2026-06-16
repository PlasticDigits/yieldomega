// SPDX-License-Identifier: AGPL-3.0-or-later

//! Open WarBow revenge windows reconciled from indexed steals + revenges (GitLab #135).

use serde_json::{json, Value};
use sqlx::{PgPool, Row};

/// Mirrors onchain `TimeArena.WARBOW_REVENGE_WINDOW_SEC` (24h).
pub const WARBOW_REVENGE_WINDOW_SEC: i64 = 86_400;

pub async fn fetch_pending_revenge(
    pool: &PgPool,
    victim: &str,
    now_sec: i64,
) -> Result<Vec<Value>, sqlx::Error> {
    let rows = sqlx::query(
        r#"WITH latest_steals AS (
               SELECT DISTINCT ON (attacker)
                   attacker,
                   block_number,
                   log_index,
                   FLOOR(COALESCE(EXTRACT(EPOCH FROM block_timestamp), 0))::bigint AS steal_sec
               FROM idx_arena_warbow_steal
               WHERE victim = $1
               ORDER BY attacker, block_number DESC, log_index DESC
           ),
           steal_counts AS (
               SELECT attacker, COUNT(*)::bigint AS steal_seq
               FROM idx_arena_warbow_steal
               WHERE victim = $1
               GROUP BY attacker
           )
           SELECT
               ls.attacker AS stealer,
               (ls.steal_sec + $2)::text AS expiry_exclusive,
               sc.steal_seq::text AS steal_seq,
               ls.block_number::text AS window_block_number,
               ls.log_index AS window_log_index
           FROM latest_steals ls
           JOIN steal_counts sc ON sc.attacker = ls.attacker
           WHERE (ls.steal_sec + $2) > $3
             AND NOT EXISTS (
                 SELECT 1
                 FROM idx_arena_warbow_revenge r
                 WHERE r.avenger = $1
                   AND r.stealer = ls.attacker
                   AND (r.block_number, r.log_index) > (ls.block_number, ls.log_index)
             )
           ORDER BY ls.block_number DESC, ls.log_index DESC"#,
    )
    .bind(victim)
    .bind(WARBOW_REVENGE_WINDOW_SEC)
    .bind(now_sec)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .map(|r| {
            json!({
                "stealer": r.get::<String, _>("stealer"),
                "expiry_exclusive": r.get::<String, _>("expiry_exclusive"),
                "steal_seq": r.get::<String, _>("steal_seq"),
                "window_block_number": r.get::<String, _>("window_block_number"),
                "window_log_index": r.get::<i32, _>("window_log_index"),
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::WARBOW_REVENGE_WINDOW_SEC;

    #[test]
    fn revenge_window_matches_onchain_constant() {
        assert_eq!(WARBOW_REVENGE_WINDOW_SEC, 24 * 60 * 60);
    }
}

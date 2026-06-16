// SPDX-License-Identifier: AGPL-3.0-or-later

//! Per-category participant counts for `GET /v1/arena/podiums` audit surfaces.

use sqlx::{PgPool, Row};

/// Contract category index → distinct wallet count (0=Last Buy … 3=WarBow).
pub async fn fetch_participant_counts(pool: &PgPool) -> Result<[i64; 4], sqlx::Error> {
    let row = sqlx::query(
        r#"SELECT
            (SELECT COUNT(DISTINCT buyer)::bigint FROM idx_arena_buy) AS cat_last_buy,
            (SELECT COUNT(DISTINCT buyer)::bigint
               FROM idx_arena_buy
              WHERE actual_seconds_added > 0) AS cat_time_booster,
            (SELECT COUNT(DISTINCT buyer)::bigint
               FROM idx_arena_buy
              WHERE actual_seconds_added > 0) AS cat_defended_streak,
            (SELECT COUNT(DISTINCT player)::bigint
               FROM idx_warbow_epoch_score
              WHERE battle_points > 0) AS cat_warbow"#,
    )
    .fetch_one(pool)
    .await?;

    Ok([
        row.get::<i64, _>("cat_last_buy"),
        row.get::<i64, _>("cat_time_booster"),
        row.get::<i64, _>("cat_defended_streak"),
        row.get::<i64, _>("cat_warbow"),
    ])
}

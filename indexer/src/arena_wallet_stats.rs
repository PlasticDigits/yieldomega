// SPDX-License-Identifier: AGPL-3.0-or-later

//! Aggregations for `GET /v1/arena/wallet/{address}/stats` (#255).

use serde_json::{json, Value};
use sqlx::{PgPool, Row};

/// Mirrors onchain `TimeArena` constants used for derived metrics.
const DEFENDED_STREAK_WINDOW_SEC: i64 = 900;
const WARBOW_BASE_BUY_BP: u128 = 250;
const WARBOW_TIMER_RESET_BONUS_BP: u128 = 500;
const WARBOW_CLUTCH_BONUS_BP: u128 = 150;
const WARBOW_CLUTCH_REMAINING_SEC: i64 = 30;

const PODIUM_LABELS: [&str; 4] = ["last_buy", "time_booster", "defended_streak", "warbow"];

/// Mirrors `ArenaXp` onchain (#250, #265).
const MAX_LEVEL_UPS_PER_BUY: u128 = 5;
const MAX_PLAYER_LEVEL: u128 = 5;

/// Mirrors `TimeArena` CRED constants (#248, #268).
const CRED_PER_BUY_WAD: u128 = 35_000_000_000_000_000_000;
const FIRST_BUY_CRED_BONUS_WAD: u128 = 1_100_000_000_000_000_000_000;
const CRED_PER_CHARM_WAD: u128 = 100_000_000_000_000_000_000;
const WAD: u128 = 1_000_000_000_000_000_000;

fn xp_to_advance(level: u128) -> u128 {
    if level == 0 {
        return 10;
    }
    let mut step = 10 + (level - 1) * 5;
    if step > 100 {
        step = 100;
    }
    step
}

fn apply_xp_gain(level: u128, xp_toward_next: u128, xp_gain: u128) -> (u128, u128) {
    debug_assert!(level >= 1);
    if level >= MAX_PLAYER_LEVEL {
        return (MAX_PLAYER_LEVEL, 0);
    }
    let mut new_level = level;
    let mut new_toward = xp_toward_next.saturating_add(xp_gain);
    let mut levels_gained = 0u128;
    while levels_gained < MAX_LEVEL_UPS_PER_BUY && new_level < MAX_PLAYER_LEVEL {
        let need = xp_to_advance(new_level);
        if new_toward < need {
            break;
        }
        new_toward -= need;
        new_level += 1;
        levels_gained += 1;
    }
    if new_level >= MAX_PLAYER_LEVEL {
        new_level = MAX_PLAYER_LEVEL;
        new_toward = 0;
    }
    (new_level, new_toward)
}

fn parse_u128_decimal(s: &str) -> u128 {
    s.parse::<u128>().unwrap_or(0)
}

fn pending_cred_from_epoch_parts(weight: u128, total: u128, doub_buys: u64, bonus: u128) -> u128 {
    let pool = (doub_buys as u128).saturating_mul(CRED_PER_BUY_WAD);
    let pro_rata = if weight > 0 && total > 0 {
        pool.saturating_mul(weight) / total
    } else {
        0
    };
    pro_rata.saturating_add(bonus)
}

async fn fetch_global_last_buy_epoch(pool: &PgPool) -> Result<u64, sqlx::Error> {
    let epoch: i64 = sqlx::query_scalar(
        r#"SELECT COALESCE(MAX(epoch), 0)::bigint FROM idx_arena_last_buy_epoch_started"#,
    )
    .fetch_one(pool)
    .await?;
    Ok(epoch.max(0) as u64)
}

struct EpochCharmCredParts {
    weight: u128,
    total: u128,
    doub_buys: u64,
}

async fn fetch_epoch_charm_cred_parts(
    pool: &PgPool,
    wallet: &str,
    epoch: u64,
) -> Result<EpochCharmCredParts, sqlx::Error> {
    let row = sqlx::query(
        r#"SELECT COALESCE(SUM(CASE WHEN buyer = $1 THEN charm_wad ELSE 0 END), 0)::text AS weight,
                  COALESCE(SUM(charm_wad), 0)::text AS total,
                  COUNT(*) FILTER (WHERE NOT paid_with_cred)::bigint AS doub_buys
           FROM idx_arena_buy
           WHERE last_buy_epoch = $2"#,
    )
    .bind(wallet)
    .bind(epoch as i64)
    .fetch_one(pool)
    .await?;
    Ok(EpochCharmCredParts {
        weight: parse_u128_decimal(&row.get::<String, _>("weight")),
        total: parse_u128_decimal(&row.get::<String, _>("total")),
        doub_buys: row.get::<i64, _>("doub_buys").max(0) as u64,
    })
}

async fn fetch_first_buy_bonus_epoch(pool: &PgPool, wallet: &str) -> Result<Option<u64>, sqlx::Error> {
    let epoch: Option<i64> = sqlx::query_scalar(
        r#"SELECT (last_buy_epoch + 1)::bigint
           FROM idx_arena_buy
           WHERE buyer = $1
           ORDER BY block_number ASC, log_index ASC
           LIMIT 1"#,
    )
    .bind(wallet)
    .fetch_optional(pool)
    .await?;
    Ok(epoch.map(|e| e.max(0) as u64))
}

async fn cred_epoch_claimed(pool: &PgPool, wallet: &str, epoch: u64) -> Result<bool, sqlx::Error> {
    let claimed: bool = sqlx::query_scalar(
        r#"SELECT EXISTS(
               SELECT 1 FROM idx_play_cred_claim
               WHERE claimer = $1 AND epoch = $2::numeric
           )"#,
    )
    .bind(wallet)
    .bind(epoch.to_string())
    .fetch_one(pool)
    .await?;
    Ok(claimed)
}

async fn pending_cred_for_epoch(
    pool: &PgPool,
    wallet: &str,
    epoch: u64,
    bonus_epoch: Option<u64>,
) -> Result<String, sqlx::Error> {
    let parts = fetch_epoch_charm_cred_parts(pool, wallet, epoch).await?;
    let bonus = if bonus_epoch == Some(epoch) {
        FIRST_BUY_CRED_BONUS_WAD
    } else {
        0
    };
    Ok(pending_cred_from_epoch_parts(parts.weight, parts.total, parts.doub_buys, bonus).to_string())
}

async fn fetch_cred_balance_wad(pool: &PgPool, wallet: &str) -> Result<String, sqlx::Error> {
    sqlx::query_scalar(
        r#"SELECT (
              COALESCE((SELECT SUM(referrer_cred) FROM idx_arena_referral_cred WHERE referrer = $1), 0)
            + COALESCE((SELECT SUM(buyer_cred) FROM idx_arena_referral_cred WHERE buyer = $1), 0)
            + COALESCE((SELECT SUM(amount) FROM idx_play_cred_claim WHERE claimer = $1), 0)
            - COALESCE((
                SELECT SUM((charm_wad * $2::numeric) / $3::numeric)
                FROM idx_arena_buy
                WHERE buyer = $1 AND paid_with_cred
              ), 0)
           )::text"#,
    )
    .bind(wallet)
    .bind(CRED_PER_CHARM_WAD.to_string())
    .bind(WAD.to_string())
    .fetch_one(pool)
    .await
}

async fn fetch_xp_progression(pool: &PgPool, wallet: &str) -> Result<(String, String), sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT xp_gained::text AS xp_gained
           FROM idx_player_xp
           WHERE player = $1
           ORDER BY block_number ASC, log_index ASC"#,
    )
    .bind(wallet)
    .fetch_all(pool)
    .await?;

    let mut level = 1u128;
    let mut toward = 0u128;
    for row in rows {
        let gain_s: String = row.get("xp_gained");
        let gain = gain_s.parse::<u128>().unwrap_or(0);
        (level, toward) = apply_xp_gain(level, toward, gain);
    }
    Ok((level.to_string(), toward.to_string()))
}

#[derive(Debug, Clone)]
struct BuyRow {
    buyer: String,
    charm_wad: u128,
    actual_seconds_added: u128,
    new_deadline: u128,
    block_timestamp_sec: Option<i64>,
    timer_hard_reset: bool,
    last_buy_epoch: u64,
    order_key: u64,
}

#[derive(Debug, Clone)]
struct StealRow {
    attacker: String,
    victim: String,
    bp_taken: u128,
    order_key: u64,
}

#[derive(Debug, Clone)]
struct PodiumPlacement {
    category: i16,
    epoch: String,
    rank: u8,
    pool_paid: u128,
}

#[derive(Debug, Clone)]
struct HighestScore {
    podium: &'static str,
    epoch: String,
    score: String,
    rank: Option<u8>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TimelineKind {
    Buy,
    Steal,
    WarbowReset,
}

#[derive(Debug, Clone)]
struct TimelineEvent {
    kind: TimelineKind,
    order_key: u64,
    buy: Option<BuyRow>,
    steal: Option<StealRow>,
}

pub async fn fetch_wallet_stats(pool: &PgPool, wallet: &str) -> Result<Value, sqlx::Error> {
    let buy_agg = sqlx::query(
        r#"SELECT COUNT(*)::bigint AS buy_count,
                  COALESCE(SUM(doub_paid), 0)::text AS total_spent,
                  COALESCE(AVG(doub_paid), 0)::text AS avg_buy,
                  COALESCE(MAX(doub_paid), 0)::text AS max_buy,
                  MIN(EXTRACT(EPOCH FROM block_timestamp))::text AS first_buy_sec
           FROM idx_arena_buy WHERE buyer = $1"#,
    )
    .bind(wallet)
    .fetch_one(pool)
    .await?;

    let buy_count: i64 = buy_agg.get("buy_count");
    let total_spent: String = buy_agg.get("total_spent");
    let avg_buy: String = buy_agg.get("avg_buy");
    let max_buy: String = buy_agg.get("max_buy");
    let first_buy_sec: Option<String> = buy_agg.try_get("first_buy_sec").ok();

    let epochs_participated: i64 = if buy_count == 0 {
        0
    } else {
        sqlx::query_scalar(
            r#"SELECT COUNT(DISTINCT last_buy_epoch)::bigint
               FROM idx_arena_buy
               WHERE buyer = $1"#,
        )
        .bind(wallet)
        .fetch_one(pool)
        .await?
    };

    let xp_row = sqlx::query(
        r#"SELECT COALESCE(SUM(xp_gained), 0)::text AS total_xp
           FROM idx_player_xp WHERE player = $1"#,
    )
    .bind(wallet)
    .fetch_optional(pool)
    .await?;

    let xp = xp_row
        .map(|r| r.get::<String, _>("total_xp"))
        .unwrap_or_else(|| "0".into());

    let (level, xp_toward_next) = fetch_xp_progression(pool, wallet).await?;

    let cred_claimed: String = sqlx::query_scalar(
        r#"SELECT COALESCE(SUM(amount), 0)::text FROM idx_play_cred_claim WHERE claimer = $1"#,
    )
    .bind(wallet)
    .fetch_one(pool)
    .await?;

    let warbow_steals: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM idx_arena_warbow_steal WHERE attacker = $1"#,
    )
    .bind(wallet)
    .fetch_one(pool)
    .await?;

    let warbow_guards: i64 = sqlx::query_scalar(
        r#"SELECT COUNT(*)::bigint FROM idx_arena_warbow_guard WHERE player = $1"#,
    )
    .bind(wallet)
    .fetch_one(pool)
    .await?;

    let referral_cred_earned: String = sqlx::query_scalar(
        r#"SELECT (
              COALESCE((SELECT SUM(referrer_cred) FROM idx_arena_referral_cred WHERE referrer = $1), 0)
            + COALESCE((SELECT SUM(buyer_cred) FROM idx_arena_referral_cred WHERE buyer = $1), 0)
           )::text"#,
    )
    .bind(wallet)
    .fetch_one(pool)
    .await?;

    let wallet_buys = fetch_wallet_buys(pool, wallet).await?;
    let global_buys = fetch_all_buys_ordered(pool).await?;
    let steals = fetch_all_steals(pool).await?;
    let warbow_resets = fetch_warbow_epoch_resets(pool).await?;

    let longest_defended_streak =
        simulate_longest_defended_streak(&global_buys, wallet).to_string();

    let placements = fetch_podium_placements(pool, wallet).await?;
    let prizes_won = prizes_from_placements(&placements);
    let total_won_doub = sum_decimal_strings(prizes_won.iter().map(|p| p.amount_doub.as_str()));

    let rank_distribution = rank_distribution_from_placements(&placements);
    let podium_win_rate = podium_win_rate(epochs_participated, &placements);

    let warbow_battle_points =
        resolve_warbow_battle_points(wallet, pool, &global_buys, &steals, &warbow_resets).await?;
    let warbow_guard_until = fetch_latest_warbow_guard_until(pool, wallet).await?;

    let highest_scores = compute_highest_scores(
        wallet,
        &wallet_buys,
        &global_buys,
        &steals,
        &warbow_resets,
        &placements,
    );

    let level_cap = level.parse::<u64>().unwrap_or(1).min(5);
    let level_s = level_cap.to_string();

    let last_buy_epoch = fetch_global_last_buy_epoch(pool).await?;
    let bonus_epoch = fetch_first_buy_bonus_epoch(pool, wallet).await?;
    let epoch_parts = fetch_epoch_charm_cred_parts(pool, wallet, last_buy_epoch).await?;
    let epoch_charm_wad = epoch_parts.weight.to_string();
    let epoch_charm_total_wad = epoch_parts.total.to_string();
    let pending_cred_accrual =
        pending_cred_for_epoch(pool, wallet, last_buy_epoch, bonus_epoch).await?;

    let (claimable_cred_epoch, claimable_cred) = if last_buy_epoch > 0 {
        let ended = last_buy_epoch - 1;
        let claimed = cred_epoch_claimed(pool, wallet, ended).await?;
        let pending = if claimed {
            0u128
        } else {
            parse_u128_decimal(
                &pending_cred_for_epoch(pool, wallet, ended, bonus_epoch).await?,
            )
        };
        (Some(ended.to_string()), pending.to_string())
    } else {
        (None, "0".into())
    };

    let cred_balance_wad = fetch_cred_balance_wad(pool, wallet).await?;

    Ok(json!({
        "address": wallet,
        "epochs_participated": epochs_participated,
        "buy_count": buy_count,
        "total_spent_doub": total_spent,
        "average_buy_doub": avg_buy,
        "max_single_buy_doub": max_buy,
        "first_buy_at": first_buy_sec,
        "xp": xp,
        "level": level_s,
        "xp_toward_next": xp_toward_next,
        "unlocked_level": level_s,
        "last_buy_epoch": last_buy_epoch.to_string(),
        "epoch_charm_wad": epoch_charm_wad,
        "epoch_charm_total_wad": epoch_charm_total_wad,
        "epoch_doub_buy_count": epoch_parts.doub_buys.to_string(),
        "pending_cred_accrual": pending_cred_accrual,
        "claimable_cred_epoch": claimable_cred_epoch,
        "claimable_cred": claimable_cred,
        "cred_balance_wad": cred_balance_wad,
        "prizes_won": prizes_won,
        "total_won_doub": total_won_doub,
        "highest_scores": highest_scores,
        "warbow_battle_points": warbow_battle_points,
        "warbow_guard_until": warbow_guard_until,
        "warbow_steals": warbow_steals,
        "warbow_guards": warbow_guards,
        "cred_claimed": cred_claimed,
        "referral_cred_earned": referral_cred_earned,
        "longest_defended_streak": longest_defended_streak,
        "podium_win_rate": podium_win_rate,
        "rank_distribution": rank_distribution,
    }))
}

#[derive(Debug, serde::Serialize)]
struct PrizeWon {
    podium: &'static str,
    epoch: String,
    rank: u8,
    amount_doub: String,
}

fn order_key(block_number: i64, log_index: i32) -> u64 {
    (block_number as u64) << 32 | (log_index as u64)
}

async fn fetch_wallet_buys(pool: &PgPool, wallet: &str) -> Result<Vec<BuyRow>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT buyer, charm_wad::text, actual_seconds_added::text, new_deadline::text,
                  EXTRACT(EPOCH FROM block_timestamp)::bigint AS block_ts,
                  timer_hard_reset, block_number, log_index, last_buy_epoch
           FROM idx_arena_buy
           WHERE buyer = $1
           ORDER BY block_number, log_index"#,
    )
    .bind(wallet)
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(parse_buy_row).collect())
}

async fn fetch_all_buys_ordered(pool: &PgPool) -> Result<Vec<BuyRow>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT buyer, charm_wad::text, actual_seconds_added::text, new_deadline::text,
                  EXTRACT(EPOCH FROM block_timestamp)::bigint AS block_ts,
                  timer_hard_reset, block_number, log_index, last_buy_epoch
           FROM idx_arena_buy
           ORDER BY block_number, log_index"#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows.iter().map(parse_buy_row).collect())
}

fn parse_buy_row(r: &sqlx::postgres::PgRow) -> BuyRow {
    let block_number: i64 = r.get("block_number");
    let log_index: i32 = r.get("log_index");
    BuyRow {
        buyer: r.get("buyer"),
        charm_wad: parse_u128(r.get::<String, _>("charm_wad")),
        actual_seconds_added: parse_u128(r.get::<String, _>("actual_seconds_added")),
        new_deadline: parse_u128(r.get::<String, _>("new_deadline")),
        block_timestamp_sec: r.get("block_ts"),
        timer_hard_reset: r.get("timer_hard_reset"),
        last_buy_epoch: r.get::<i64, _>("last_buy_epoch") as u64,
        order_key: order_key(block_number, log_index),
    }
}

async fn fetch_all_steals(pool: &PgPool) -> Result<Vec<StealRow>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT attacker, victim, bp_taken::text, block_number, log_index
           FROM idx_arena_warbow_steal
           ORDER BY block_number, log_index"#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let block_number: i64 = r.get("block_number");
            let log_index: i32 = r.get("log_index");
            StealRow {
                attacker: r.get("attacker"),
                victim: r.get("victim"),
                bp_taken: parse_u128(r.get::<String, _>("bp_taken")),
                order_key: order_key(block_number, log_index),
            }
        })
        .collect())
}

async fn fetch_warbow_epoch_resets(pool: &PgPool) -> Result<Vec<u64>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT block_number, log_index
           FROM idx_arena_podium_epoch
           WHERE category = 3
           ORDER BY block_number, log_index"#,
    )
    .fetch_all(pool)
    .await?;
    Ok(rows
        .iter()
        .map(|r| {
            let bn: i64 = r.get("block_number");
            let li: i32 = r.get("log_index");
            order_key(bn, li)
        })
        .collect())
}

async fn fetch_podium_placements(
    pool: &PgPool,
    wallet: &str,
) -> Result<Vec<PodiumPlacement>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT category, epoch::text, pool_paid::text,
                  CASE
                    WHEN first_place = $1 THEN 1
                    WHEN second_place = $1 THEN 2
                    WHEN third_place = $1 THEN 3
                  END AS rank
           FROM idx_arena_podium_epoch
           WHERE first_place = $1 OR second_place = $1 OR third_place = $1
           ORDER BY block_number, log_index"#,
    )
    .bind(wallet)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .iter()
        .filter_map(|r| {
            let rank: Option<i32> = r.get("rank");
            let rank = rank? as u8;
            Some(PodiumPlacement {
                category: r.get("category"),
                epoch: r.get("epoch"),
                rank,
                pool_paid: parse_u128(r.get::<String, _>("pool_paid")),
            })
        })
        .collect())
}

fn remaining_before_sec(buy: &BuyRow) -> i64 {
    let ts = buy.block_timestamp_sec.unwrap_or(0);
    let deadline_before = if buy.actual_seconds_added > 0 {
        buy.new_deadline.saturating_sub(buy.actual_seconds_added)
    } else {
        buy.new_deadline
    };
    if deadline_before <= ts as u128 {
        return 0;
    }
    (deadline_before - ts as u128) as i64
}

fn warbow_buy_bp(buy: &BuyRow) -> u128 {
    let mut bp = WARBOW_BASE_BUY_BP;
    if buy.timer_hard_reset {
        bp += WARBOW_TIMER_RESET_BONUS_BP;
    }
    if remaining_before_sec(buy) < WARBOW_CLUTCH_REMAINING_SEC {
        bp += WARBOW_CLUTCH_BONUS_BP;
    }
    bp
}

fn simulate_longest_defended_streak(global_buys: &[BuyRow], wallet: &str) -> u64 {
    let mut ds_last_under_window: Option<&str> = None;
    let mut active: u64 = 0;
    let mut best: u64 = 0;

    for buy in global_buys {
        let remaining = remaining_before_sec(buy);
        let seconds_added = buy.actual_seconds_added;

        if remaining < DEFENDED_STREAK_WINDOW_SEC && seconds_added > 0 {
            if ds_last_under_window == Some(buy.buyer.as_str()) {
                if buy.buyer == wallet {
                    active += 1;
                }
            } else if buy.buyer == wallet {
                active = 1;
            } else {
                active = 0;
            }
            ds_last_under_window = Some(&buy.buyer);
            if buy.buyer == wallet && active > best {
                best = active;
            }
        } else if remaining >= DEFENDED_STREAK_WINDOW_SEC && buy.buyer == wallet {
            active = 0;
        }
    }
    best
}

fn build_timeline(
    global_buys: &[BuyRow],
    steals: &[StealRow],
    warbow_resets: &[u64],
) -> Vec<TimelineEvent> {
    let mut events = Vec::with_capacity(global_buys.len() + steals.len() + warbow_resets.len());
    for buy in global_buys {
        events.push(TimelineEvent {
            kind: TimelineKind::Buy,
            order_key: buy.order_key,
            buy: Some(buy.clone()),
            steal: None,
        });
    }
    for steal in steals {
        events.push(TimelineEvent {
            kind: TimelineKind::Steal,
            order_key: steal.order_key,
            buy: None,
            steal: Some(steal.clone()),
        });
    }
    for &key in warbow_resets {
        events.push(TimelineEvent {
            kind: TimelineKind::WarbowReset,
            order_key: key,
            buy: None,
            steal: None,
        });
    }
    events.sort_by_key(|e| e.order_key);
    events
}

/// Returns `(current_bp, peak_bp, peak_epoch)` after replaying global WarBow timeline.
fn simulate_warbow_bp(
    wallet: &str,
    global_buys: &[BuyRow],
    steals: &[StealRow],
    warbow_resets: &[u64],
) -> (u128, u128, String) {
    let timeline = build_timeline(global_buys, steals, warbow_resets);
    let mut bp: u128 = 0;
    let mut peak: u128 = 0;
    let mut peak_epoch = "0".to_string();

    for event in timeline {
        match event.kind {
            TimelineKind::WarbowReset => {
                bp = 0;
            }
            TimelineKind::Buy => {
                let buy = event.buy.expect("buy event");
                if buy.buyer == wallet {
                    bp = bp.saturating_add(warbow_buy_bp(&buy));
                    if bp > peak {
                        peak = bp;
                        peak_epoch = buy.last_buy_epoch.to_string();
                    }
                }
            }
            TimelineKind::Steal => {
                let steal = event.steal.expect("steal event");
                if steal.attacker == wallet {
                    bp = bp.saturating_add(steal.bp_taken);
                    if bp > peak {
                        peak = bp;
                    }
                }
                if steal.victim == wallet {
                    bp = bp.saturating_sub(steal.bp_taken);
                }
            }
        }
    }

    (bp, peak, peak_epoch)
}

async fn fetch_latest_warbow_guard_until(
    pool: &PgPool,
    wallet: &str,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        r#"SELECT guard_until::text
           FROM idx_arena_warbow_guard
           WHERE player = $1
           ORDER BY block_number DESC, log_index DESC
           LIMIT 1"#,
    )
    .bind(wallet)
    .fetch_optional(pool)
    .await
}

async fn fetch_latest_warbow_battle_points(
    pool: &PgPool,
    wallet: &str,
) -> Result<Option<String>, sqlx::Error> {
    sqlx::query_scalar(
        r#"SELECT battle_points::text
           FROM idx_warbow_epoch_score
           WHERE player = $1
           ORDER BY block_number DESC, log_index DESC
           LIMIT 1"#,
    )
    .bind(wallet)
    .fetch_optional(pool)
    .await
}

/// Latest indexed on-chain snapshot, else simulated current BP from arena timeline.
async fn resolve_warbow_battle_points(
    wallet: &str,
    pool: &PgPool,
    global_buys: &[BuyRow],
    steals: &[StealRow],
    warbow_resets: &[u64],
) -> Result<String, sqlx::Error> {
    if let Some(db_bp) = fetch_latest_warbow_battle_points(pool, wallet).await? {
        return Ok(db_bp);
    }
    let (current, _, _) = simulate_warbow_bp(wallet, global_buys, steals, warbow_resets);
    Ok(current.to_string())
}

fn payout_shares(pool: u128) -> (u128, u128, u128) {
    let first = pool * 4 / 7;
    let second = pool * 2 / 7;
    let third = pool.saturating_sub(first).saturating_sub(second);
    (first, second, third)
}

fn prizes_from_placements(placements: &[PodiumPlacement]) -> Vec<PrizeWon> {
    placements
        .iter()
        .map(|p| {
            let (a, b, c) = payout_shares(p.pool_paid);
            let amount = match p.rank {
                1 => a,
                2 => b,
                _ => c,
            };
            PrizeWon {
                podium: PODIUM_LABELS
                    .get(p.category as usize)
                    .copied()
                    .unwrap_or("unknown"),
                epoch: p.epoch.clone(),
                rank: p.rank,
                amount_doub: amount.to_string(),
            }
        })
        .collect()
}

fn rank_distribution_from_placements(placements: &[PodiumPlacement]) -> Value {
    let mut counts = [0i64; 3];
    for p in placements {
        if p.rank >= 1 && p.rank <= 3 {
            counts[p.rank as usize - 1] += 1;
        }
    }
    json!({
        "1": counts[0].to_string(),
        "2": counts[1].to_string(),
        "3": counts[2].to_string(),
    })
}

fn podium_win_rate(epochs_participated: i64, placements: &[PodiumPlacement]) -> String {
    if epochs_participated == 0 {
        return "0".into();
    }
    let wins = placements.len() as f64;
    let rate = wins / epochs_participated as f64;
    format!("{rate:.4}")
}

fn compute_highest_scores(
    wallet: &str,
    wallet_buys: &[BuyRow],
    global_buys: &[BuyRow],
    steals: &[StealRow],
    warbow_resets: &[u64],
    placements: &[PodiumPlacement],
) -> Vec<Value> {
    let mut scores: Vec<HighestScore> = Vec::with_capacity(4);

    let mut charm_by_epoch: std::collections::HashMap<u64, u128> = std::collections::HashMap::new();
    for buy in wallet_buys {
        *charm_by_epoch.entry(buy.last_buy_epoch).or_insert(0) += buy.charm_wad;
    }
    if let Some((epoch, charm)) = charm_by_epoch.iter().max_by_key(|(_, v)| *v) {
        let epoch_s = epoch.to_string();
        scores.push(HighestScore {
            podium: "last_buy",
            epoch: epoch_s.clone(),
            score: charm.to_string(),
            rank: placement_rank(placements, 0, &epoch_s),
        });
    }

    let mut cumulative: u128 = 0;
    let mut peak_timer = 0u128;
    let mut peak_timer_epoch = "0".to_string();
    for buy in wallet_buys {
        cumulative = cumulative.saturating_add(buy.actual_seconds_added);
        if cumulative > peak_timer {
            peak_timer = cumulative;
            peak_timer_epoch = buy.last_buy_epoch.to_string();
        }
    }
    if !wallet_buys.is_empty() {
        scores.push(HighestScore {
            podium: "time_booster",
            epoch: peak_timer_epoch.clone(),
            score: peak_timer.to_string(),
            rank: placement_rank(placements, 1, &peak_timer_epoch),
        });
    }

    let best_streak = simulate_longest_defended_streak(global_buys, wallet);
    let streak_epoch = wallet_buys
        .last()
        .map(|b| b.last_buy_epoch.to_string())
        .unwrap_or_else(|| "0".into());
    scores.push(HighestScore {
        podium: "defended_streak",
        epoch: streak_epoch,
        score: best_streak.to_string(),
        rank: placements
            .iter()
            .find(|p| p.category == 2)
            .map(|p| p.rank),
    });

    let (_, peak_bp, bp_epoch) = simulate_warbow_bp(wallet, global_buys, steals, warbow_resets);
    scores.push(HighestScore {
        podium: "warbow",
        epoch: bp_epoch,
        score: peak_bp.to_string(),
        rank: placements
            .iter()
            .find(|p| p.category == 3)
            .map(|p| p.rank),
    });

    scores
        .into_iter()
        .map(|s| {
            json!({
                "podium": s.podium,
                "epoch": s.epoch,
                "score": s.score,
                "rank": s.rank,
            })
        })
        .collect()
}

fn placement_rank(placements: &[PodiumPlacement], category: i16, epoch: &str) -> Option<u8> {
    placements
        .iter()
        .find(|p| p.category == category && p.epoch == epoch)
        .map(|p| p.rank)
}

fn parse_u128(s: String) -> u128 {
    s.parse().unwrap_or(0)
}

fn sum_decimal_strings<'a, I: Iterator<Item = &'a str>>(values: I) -> String {
    let sum: u128 = values.filter_map(|v| v.parse::<u128>().ok()).sum();
    sum.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payout_shares_4_2_1() {
        let (a, b, c) = payout_shares(700);
        assert_eq!(a, 400);
        assert_eq!(b, 200);
        assert_eq!(c, 100);
    }

    #[test]
    fn remaining_before_uses_deadline_delta() {
        let buy = BuyRow {
            buyer: "0x1".into(),
            charm_wad: 1,
            actual_seconds_added: 120,
            new_deadline: 1000,
            block_timestamp_sec: Some(800),
            timer_hard_reset: false,
            last_buy_epoch: 0,
            order_key: 1,
        };
        assert_eq!(remaining_before_sec(&buy), 80);
    }

    #[test]
    fn warbow_buy_bp_hard_reset_bonus() {
        let buy = BuyRow {
            buyer: "0x1".into(),
            charm_wad: 1,
            actual_seconds_added: 900,
            new_deadline: 1700,
            block_timestamp_sec: Some(750),
            timer_hard_reset: true,
            last_buy_epoch: 1,
            order_key: 2,
        };
        assert_eq!(warbow_buy_bp(&buy), WARBOW_BASE_BUY_BP + WARBOW_TIMER_RESET_BONUS_BP);
    }

    #[test]
    fn simulate_warbow_bp_tracks_steals() {
        let wallet = "0xalice";
        let other = "0xother";
        let buys = vec![BuyRow {
            buyer: wallet.into(),
            charm_wad: 1,
            actual_seconds_added: 0,
            new_deadline: 100,
            block_timestamp_sec: Some(50),
            timer_hard_reset: false,
            last_buy_epoch: 0,
            order_key: 10,
        }];
        let steals = vec![StealRow {
            attacker: wallet.into(),
            victim: other.into(),
            bp_taken: 100,
            order_key: 20,
        }];
        let (current, peak, _) = simulate_warbow_bp(wallet, &buys, &steals, &[]);
        assert_eq!(current, WARBOW_BASE_BUY_BP + 100);
        assert_eq!(peak, WARBOW_BASE_BUY_BP + 100);
    }

    #[test]
    fn podium_win_rate_zero_when_no_epochs() {
        assert_eq!(podium_win_rate(0, &[]), "0");
    }

    #[test]
    fn apply_xp_gain_caps_level_ups_per_buy() {
        let (level, toward) = apply_xp_gain(1, 0, 200);
        assert_eq!(level, 5);
        assert_eq!(toward, 0);
    }

    #[test]
    fn apply_xp_gain_discards_xp_at_max_level() {
        let (level, toward) = apply_xp_gain(5, 5, 10);
        assert_eq!(level, 5);
        assert_eq!(toward, 0);
    }

    #[test]
    fn apply_xp_gain_matches_lv4_one_of_twenty_five_progress() {
        let (level, toward) = apply_xp_gain(1, 0, 46);
        assert_eq!(level, 4);
        assert_eq!(toward, 1);
    }

    #[test]
    fn pending_cred_pro_rata_plus_bonus() {
        let pending = pending_cred_from_epoch_parts(WAD, WAD * 2, 2, FIRST_BUY_CRED_BONUS_WAD);
        assert_eq!(pending, CRED_PER_BUY_WAD + FIRST_BUY_CRED_BONUS_WAD);
    }
}

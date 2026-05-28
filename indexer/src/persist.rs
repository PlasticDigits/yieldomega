// SPDX-License-Identifier: AGPL-3.0-or-later

//! Insert decoded Arena v2 events (idempotent via ON CONFLICT).

use alloy_primitives::{Address, U256};
use eyre::Result;
use sqlx::postgres::PgConnection;
use sqlx::PgPool;

use crate::decoder::{DecodedEvent, DecodedLog};

fn u256_dec(n: U256) -> String {
    n.to_string()
}

fn addr_hex(a: Address) -> String {
    format!("{:#x}", a)
}

fn b256_hex(h: alloy_primitives::B256) -> String {
    format!("{:#x}", h)
}

pub async fn persist_decoded_log_conn(conn: &mut PgConnection, d: &DecodedLog) -> Result<()> {
    let block = d.block_number as i64;
    let tx_h = b256_hex(d.tx_hash);
    let log_i = d.log_index as i32;
    let block_ts: Option<i64> = d.block_timestamp.map(|t| t as i64);

    match &d.event {
        DecodedEvent::ArenaStarted {
            start_timestamp,
            initial_deadline,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_started (
                    block_number, tx_hash, log_index, start_timestamp, initial_deadline
                ) VALUES ($1, $2, $3, $4::numeric, $5::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(u256_dec(*start_timestamp))
            .bind(u256_dec(*initial_deadline))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaBuy {
            buyer,
            charm_wad,
            doub_paid,
            new_deadline,
            total_doub_raised_after,
            buy_index,
            actual_seconds_added,
            timer_hard_reset,
            paid_with_cred,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_buy (
                    block_number, block_timestamp, tx_hash, log_index, buyer,
                    charm_wad, doub_paid, new_deadline, total_doub_raised_after, buy_index,
                    actual_seconds_added, timer_hard_reset, paid_with_cred
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric, $7::numeric, $8::numeric,
                    $9::numeric, $10::numeric, $11::numeric, $12, $13)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*buyer))
            .bind(u256_dec(*charm_wad))
            .bind(u256_dec(*doub_paid))
            .bind(u256_dec(*new_deadline))
            .bind(u256_dec(*total_doub_raised_after))
            .bind(u256_dec(*buy_index))
            .bind(u256_dec(*actual_seconds_added))
            .bind(*timer_hard_reset)
            .bind(*paid_with_cred)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaReferralCred {
            buyer,
            referrer,
            code_hash,
            referrer_cred,
            buyer_cred,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_referral_cred (
                    block_number, tx_hash, log_index, buyer, referrer, code_hash,
                    referrer_cred, buyer_cred
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*buyer))
            .bind(addr_hex(*referrer))
            .bind(b256_hex(*code_hash))
            .bind(u256_dec(*referrer_cred))
            .bind(u256_dec(*buyer_cred))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaXpGained {
            player,
            amount,
            new_level,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_player_xp (
                    block_number, tx_hash, log_index, player, xp_gained, new_level
                ) VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*player))
            .bind(u256_dec(*amount))
            .bind(u256_dec(*new_level))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaCredClaimed { user, epoch, amount } => {
            sqlx::query(
                r#"INSERT INTO idx_play_cred_claim (
                    block_number, tx_hash, log_index, claimer, epoch, amount
                ) VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*user))
            .bind(u256_dec(*epoch))
            .bind(u256_dec(*amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaPodiumEpochRolled {
            category,
            epoch,
            first,
            second,
            third,
            pool_paid,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_podium_epoch (
                    block_number, tx_hash, log_index, category, epoch,
                    first_place, second_place, third_place, pool_paid
                ) VALUES ($1, $2, $3, $4, $5::numeric, $6, $7, $8, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(*category as i16)
            .bind(u256_dec(*epoch))
            .bind(addr_hex(*first))
            .bind(addr_hex(*second))
            .bind(addr_hex(*third))
            .bind(u256_dec(*pool_paid))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaWarbowSteal {
            attacker,
            victim,
            bp_taken,
            doub_spent,
            limit_bypass,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_warbow_steal (
                    block_number, block_timestamp, tx_hash, log_index,
                    attacker, victim, bp_taken, doub_spent, limit_bypass
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7::numeric, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*attacker))
            .bind(addr_hex(*victim))
            .bind(u256_dec(*bp_taken))
            .bind(u256_dec(*doub_spent))
            .bind(*limit_bypass)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaWarbowGuard {
            player,
            doub_spent,
            guard_until,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_warbow_guard (
                    block_number, tx_hash, log_index, player, doub_spent, guard_until
                ) VALUES ($1, $2, $3, $4, $5::numeric, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*player))
            .bind(u256_dec(*doub_spent))
            .bind(u256_dec(*guard_until))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaReferralApplied {
            buyer,
            referrer,
            code_hash,
            referrer_charm,
            buyer_charm,
            doub_paid,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_referral_applied (
                    block_number, tx_hash, log_index, buyer, referrer, code_hash,
                    referrer_amount, referee_amount, doub_paid
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*buyer))
            .bind(addr_hex(*referrer))
            .bind(b256_hex(*code_hash))
            .bind(u256_dec(*referrer_charm))
            .bind(u256_dec(*buyer_charm))
            .bind(u256_dec(*doub_paid))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ReferralCodeRegistered {
            owner,
            code_hash,
            normalized_code,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_referral_code_registered (
                    block_number, tx_hash, log_index, owner_address, code_hash, normalized_code
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*owner))
            .bind(b256_hex(*code_hash))
            .bind(normalized_code)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::Unknown { .. } => {}
    }
    Ok(())
}

pub async fn persist_decoded_log_autocommit(pool: &PgPool, d: &DecodedLog) -> Result<()> {
    let mut conn = pool.acquire().await?;
    persist_decoded_log_conn(&mut conn, d).await?;
    Ok(())
}

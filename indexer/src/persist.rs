// SPDX-License-Identifier: AGPL-3.0-or-later

//! Insert decoded Arena v2 events (idempotent via ON CONFLICT).

use alloy_primitives::{Address, U256};
use eyre::Result;
use sqlx::postgres::PgConnection;
use sqlx::PgPool;

use crate::decoder::{DecodedEvent, DecodedLog};
use crate::last_buy_epoch_head::LastBuyEpochHead;

fn u256_dec(n: U256) -> String {
    n.to_string()
}

fn addr_hex(a: Address) -> String {
    format!("{:#x}", a)
}

fn b256_hex(h: alloy_primitives::B256) -> String {
    format!("{:#x}", h)
}

pub async fn persist_decoded_log_conn(
    conn: &mut PgConnection,
    head: &mut LastBuyEpochHead,
    d: &DecodedLog,
) -> Result<()> {
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
            let last_buy_epoch = head.epoch_for_buy();
            sqlx::query(
                r#"INSERT INTO idx_arena_buy (
                    block_number, block_timestamp, tx_hash, log_index, buyer,
                    charm_wad, doub_paid, new_deadline, total_doub_raised_after, buy_index,
                    actual_seconds_added, timer_hard_reset, paid_with_cred, last_buy_epoch
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric, $7::numeric, $8::numeric,
                    $9::numeric, $10::numeric, $11::numeric, $12, $13, $14)
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
            .bind(last_buy_epoch)
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
        DecodedEvent::ArenaCredClaimed {
            user,
            epoch,
            amount,
        } => {
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
        DecodedEvent::ArenaFirstBuyCredScheduled {
            buyer,
            target_epoch,
            amount,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_first_buy_cred_scheduled (
                    block_number, block_timestamp, tx_hash, log_index,
                    buyer, target_epoch, amount
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric, $7::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*buyer))
            .bind(u256_dec(*target_epoch))
            .bind(u256_dec(*amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaLevelUp { player, new_level } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_level_up (
                    block_number, block_timestamp, tx_hash, log_index, player, new_level
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*player))
            .bind(u256_dec(*new_level))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaFeatureUnlocked {
            player,
            feature_level,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_feature_unlocked (
                    block_number, block_timestamp, tx_hash, log_index, player, feature_level
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*player))
            .bind(u256_dec(*feature_level))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaPausedSet { paused } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_paused_set (
                    block_number, block_timestamp, tx_hash, log_index, paused
                ) VALUES ($1, to_timestamp($2), $3, $4, $5)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(*paused)
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
                    block_number, block_timestamp, tx_hash, log_index, player, doub_spent, guard_until
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric, $7::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
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
        DecodedEvent::ArenaPodiumPoolTopUp {
            donor,
            amount_doub_wad,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_podium_pool_top_up (
                    block_number, block_timestamp, tx_hash, log_index,
                    donor_address, amount_doub_wad
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*donor))
            .bind(u256_dec(*amount_doub_wad))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaWarbowEpochScore {
            epoch,
            player,
            battle_points,
        } => {
            crate::warbow_score::persist_warbow_epoch_score_event(
                conn,
                d,
                *epoch,
                *player,
                *battle_points,
            )
            .await?;
        }
        DecodedEvent::ArenaWarbowRevenge {
            avenger,
            stealer,
            bp_taken,
            doub_spent,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_warbow_revenge (
                    block_number, block_timestamp, tx_hash, log_index,
                    avenger, stealer, bp_taken, doub_spent
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*avenger))
            .bind(addr_hex(*stealer))
            .bind(u256_dec(*bp_taken))
            .bind(u256_dec(*doub_spent))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaBuyViaKumbaya {
            buyer,
            charm_wad,
            gross_doub,
            pay_kind,
        } => {
            sqlx::query(
                r#"UPDATE idx_arena_buy SET pay_kind = $1 WHERE tx_hash = $2"#,
            )
            .bind(*pay_kind as i16)
            .bind(&tx_h)
            .execute(&mut *conn)
            .await?;
            let contract = addr_hex(d.contract);
            sqlx::query(
                r#"INSERT INTO idx_arena_buy_router_kumbaya (
                    block_number, block_timestamp, tx_hash, log_index, contract_address,
                    buyer, charm_wad, gross_doub, pay_kind
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7::numeric, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*buyer))
            .bind(u256_dec(*charm_wad))
            .bind(u256_dec(*gross_doub))
            .bind(*pay_kind as i16)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaWarbowFlagClaimed { player, bonus_bp } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_warbow_flag_claimed (
                    block_number, block_timestamp, tx_hash, log_index, player, bonus_bp
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(addr_hex(*player))
            .bind(u256_dec(*bonus_bp))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaWarbowPodiumFinalized {
            epoch,
            first,
            second,
            third,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_warbow_podium_finalized (
                    block_number, block_timestamp, tx_hash, log_index,
                    epoch, first_place, second_place, third_place
                ) VALUES ($1, to_timestamp($2), $3, $4, $5::numeric, $6, $7, $8)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(u256_dec(*epoch))
            .bind(addr_hex(*first))
            .bind(addr_hex(*second))
            .bind(addr_hex(*third))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaVaultFunding {
            kind,
            podium_id,
            target_epoch,
            amount_doub_wad,
            pool_address,
        } => {
            let podium_i: Option<i16> = podium_id.map(|p| p as i16);
            let pool_h = pool_address.map(addr_hex);
            let epoch_dec = target_epoch.map(u256_dec);
            sqlx::query(
                r#"INSERT INTO idx_arena_vault_funding (
                    block_number, block_timestamp, tx_hash, log_index,
                    kind, podium_id, target_epoch, amount_doub_wad, pool_address
                ) VALUES ($1, to_timestamp($2), $3, $4, $5, $6, $7::numeric, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(kind.as_db_str())
            .bind(podium_i)
            .bind(epoch_dec)
            .bind(u256_dec(*amount_doub_wad))
            .bind(pool_h.as_deref())
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::ArenaLastBuyEpochStarted { epoch, deadline } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_last_buy_epoch_started (
                    block_number, block_timestamp, tx_hash, log_index, epoch, deadline
                ) VALUES ($1, to_timestamp($2), $3, $4, $5::numeric, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(u256_dec(*epoch))
            .bind(u256_dec(*deadline))
            .execute(&mut *conn)
            .await?;
            head.apply_epoch_started(*epoch);
        }
        DecodedEvent::ArenaLastBuyEpochCharmAnchored {
            epoch,
            anchor_wad,
            doub_usd_wad,
            anchor_timestamp,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_arena_last_buy_epoch_started (
                    block_number, block_timestamp, tx_hash, log_index, epoch, deadline,
                    anchor_charm_price_wad, doub_usd_wad, anchor_timestamp_sec
                ) VALUES ($1, to_timestamp($2), $3, $4, $5::numeric, 0, $6::numeric, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(block_ts)
            .bind(&tx_h)
            .bind(log_i)
            .bind(u256_dec(*epoch))
            .bind(u256_dec(*anchor_wad))
            .bind(u256_dec(*doub_usd_wad))
            .bind(u256_dec(*anchor_timestamp))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::Unknown { .. } => {}
    }
    Ok(())
}

pub async fn persist_decoded_log_autocommit(pool: &PgPool, d: &DecodedLog) -> Result<()> {
    let mut conn = pool.acquire().await?;
    let mut head = LastBuyEpochHead::load(&mut conn).await?;
    persist_decoded_log_conn(&mut conn, &mut head, d).await?;
    Ok(())
}

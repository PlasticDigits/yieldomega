// SPDX-License-Identifier: AGPL-3.0-or-later

//! Insert decoded events (idempotent via ON CONFLICT).

use alloy_primitives::{Address, U256};
use eyre::Result;
use serde_json::json;
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

/// Persist a decoded log on an existing Postgres connection or transaction. Unknown events are skipped.
pub async fn persist_decoded_log_conn(conn: &mut PgConnection, d: &DecodedLog) -> Result<()> {
    let block = d.block_number as i64;
    let block_h = b256_hex(d.block_hash);
    let tx_h = b256_hex(d.tx_hash);
    let log_i = d.log_index as i32;
    let contract = addr_hex(d.contract);
    let block_ts: Option<i64> = d.block_timestamp.map(|t| t as i64);

    match &d.event {
        DecodedEvent::TimeCurveSaleStarted {
            start_timestamp,
            initial_deadline,
            total_tokens_for_sale,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_sale_started (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    start_timestamp, initial_deadline, total_tokens_for_sale
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*start_timestamp))
            .bind(u256_dec(*initial_deadline))
            .bind(u256_dec(*total_tokens_for_sale))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveBuy {
            buyer,
            charm_wad,
            amount,
            price_per_charm_wad,
            new_deadline,
            total_raised_after,
            buy_index,
            actual_seconds_added,
            timer_hard_reset,
            battle_points_after,
            bp_base_buy,
            bp_timer_reset_bonus,
            bp_clutch_bonus,
            bp_streak_break_bonus,
            bp_ambush_bonus,
            bp_flag_penalty,
            flag_planted,
            buyer_total_effective_timer_sec,
            buyer_active_defended_streak,
            buyer_best_defended_streak,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp,
                    buyer, amount, current_min_buy, charm_wad, price_per_charm_wad,
                    new_deadline, total_raised_after, buy_index,
                    actual_seconds_added, timer_hard_reset, battle_points_after,
                    bp_base_buy, bp_timer_reset_bonus, bp_clutch_bonus, bp_streak_break_bonus,
                    bp_ambush_bonus, bp_flag_penalty, flag_planted,
                    buyer_total_effective_timer_sec,
                    buyer_active_defended_streak, buyer_best_defended_streak
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, $10::numeric, $11::numeric, $12::numeric, $13::numeric, $14::numeric,
                    $15::numeric, $16, $17::numeric, $18::numeric, $19::numeric, $20::numeric, $21::numeric, $22::numeric, $23::numeric, $24,
                    $25::numeric, $26::numeric, $27::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*buyer))
            .bind(u256_dec(*amount))
            .bind("0")
            .bind(u256_dec(*charm_wad))
            .bind(u256_dec(*price_per_charm_wad))
            .bind(u256_dec(*new_deadline))
            .bind(u256_dec(*total_raised_after))
            .bind(u256_dec(*buy_index))
            .bind(u256_dec(*actual_seconds_added))
            .bind(*timer_hard_reset)
            .bind(u256_dec(*battle_points_after))
            .bind(u256_dec(*bp_base_buy))
            .bind(u256_dec(*bp_timer_reset_bonus))
            .bind(u256_dec(*bp_clutch_bonus))
            .bind(u256_dec(*bp_streak_break_bonus))
            .bind(u256_dec(*bp_ambush_bonus))
            .bind(u256_dec(*bp_flag_penalty))
            .bind(*flag_planted)
            .bind(u256_dec(*buyer_total_effective_timer_sec))
            .bind(u256_dec(*buyer_active_defended_streak))
            .bind(u256_dec(*buyer_best_defended_streak))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveBuyRouterBuyViaKumbaya {
            buyer,
            charm_wad,
            gross_cl8y,
            pay_kind,
        } => {
            let pk = *pay_kind as i16;
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy_router_kumbaya (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    buyer, charm_wad, gross_cl8y, pay_kind
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*buyer))
            .bind(u256_dec(*charm_wad))
            .bind(u256_dec(*gross_cl8y))
            .bind(pk)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveSaleEnded {
            end_timestamp,
            total_raised,
            total_buys,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_sale_ended (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    end_timestamp, total_raised, total_buys
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*end_timestamp))
            .bind(u256_dec(*total_raised))
            .bind(u256_dec(*total_buys))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveCharmsRedeemed {
            buyer,
            token_amount,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_charms_redeemed (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    buyer, token_amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*buyer))
            .bind(u256_dec(*token_amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurvePrizesDistributed => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_prizes_distributed (
                    block_number, block_hash, tx_hash, log_index, contract_address
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurvePrizesSettledEmptyPodiumPool { podium_pool } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_prizes_settled_empty_podium_pool (
                    block_number, block_hash, tx_hash, log_index, contract_address, podium_pool
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*podium_pool))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveReferralApplied {
            buyer,
            referrer,
            code_hash,
            referrer_amount,
            referee_amount,
            amount_to_fee_router,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_referral_applied (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    buyer, referrer, code_hash, referrer_amount, referee_amount, amount_to_fee_router
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric, $11::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*buyer))
            .bind(addr_hex(*referrer))
            .bind(b256_hex(*code_hash))
            .bind(u256_dec(*referrer_amount))
            .bind(u256_dec(*referee_amount))
            .bind(u256_dec(*amount_to_fee_router))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowSteal {
            attacker,
            victim,
            amount_bp,
            burn_paid_wad,
            bypassed_victim_daily_limit,
            victim_bp_after,
            attacker_bp_after,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_steal (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, attacker, victim, amount_bp, burn_paid_wad,
                    bypassed_victim_daily_limit, victim_bp_after, attacker_bp_after
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric, $11, $12::numeric, $13::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*attacker))
            .bind(addr_hex(*victim))
            .bind(u256_dec(*amount_bp))
            .bind(u256_dec(*burn_paid_wad))
            .bind(*bypassed_victim_daily_limit)
            .bind(u256_dec(*victim_bp_after))
            .bind(u256_dec(*attacker_bp_after))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowRevengeWindowOpened {
            victim,
            stealer,
            expiry_exclusive,
            steal_seq,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_revenge_window (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, victim, stealer, expiry_exclusive, steal_seq
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*victim))
            .bind(addr_hex(*stealer))
            .bind(u256_dec(*expiry_exclusive))
            .bind(u256_dec(*steal_seq))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowRevenge {
            avenger,
            stealer,
            amount_bp,
            burn_paid_wad,
            stealer_bp_after,
            avenger_bp_after,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_revenge (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, avenger, stealer, amount_bp, burn_paid_wad,
                    stealer_bp_after, avenger_bp_after
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric, $10::numeric, $11::numeric, $12::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*avenger))
            .bind(addr_hex(*stealer))
            .bind(u256_dec(*amount_bp))
            .bind(u256_dec(*burn_paid_wad))
            .bind(stealer_bp_after.map(|n| u256_dec(n)))
            .bind(avenger_bp_after.map(|n| u256_dec(n)))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowGuardActivated {
            player,
            guard_until_ts,
            burn_paid_wad,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_guard (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, player, guard_until_ts, burn_paid_wad
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*player))
            .bind(u256_dec(*guard_until_ts))
            .bind(u256_dec(*burn_paid_wad))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowFlagClaimed {
            player,
            bonus_bp,
            battle_points_after,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_flag_claimed (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, player, bonus_bp, battle_points_after
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*player))
            .bind(u256_dec(*bonus_bp))
            .bind(u256_dec(*battle_points_after))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowFlagPenalized {
            former_holder,
            penalty_bp,
            triggering_buyer,
            battle_points_after,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_flag_penalized (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, former_holder, penalty_bp, triggering_buyer, battle_points_after
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9, $10::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*former_holder))
            .bind(u256_dec(*penalty_bp))
            .bind(addr_hex(*triggering_buyer))
            .bind(u256_dec(*battle_points_after))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowCl8yBurned {
            payer,
            reason,
            amount_wad,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_cl8y_burned (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, payer, reason, amount_wad
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*payer))
            .bind(i16::from(*reason))
            .bind(u256_dec(*amount_wad))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowDefendedStreakContinued {
            wallet,
            active_streak,
            best_streak,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_ds_continued (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, wallet, active_streak, best_streak
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*wallet))
            .bind(u256_dec(*active_streak))
            .bind(u256_dec(*best_streak))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowDefendedStreakBroken {
            former_holder,
            interrupter,
            broken_active_length,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_ds_broken (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, former_holder, interrupter, broken_active_length
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*former_holder))
            .bind(addr_hex(*interrupter))
            .bind(u256_dec(*broken_active_length))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveWarBowDefendedStreakWindowCleared { cleared_wallet } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_warbow_ds_window_cleared (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    block_timestamp, cleared_wallet
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(block_ts)
            .bind(addr_hex(*cleared_wallet))
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
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    owner_address, code_hash, normalized_code
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*owner))
            .bind(b256_hex(*code_hash))
            .bind(normalized_code.as_str())
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::PodiumPoolPaid {
            winner,
            token,
            amount,
            category,
            placement,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_podium_pool_paid (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    winner, token, amount, category, placement
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9, $10)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*winner))
            .bind(addr_hex(*token))
            .bind(u256_dec(*amount))
            .bind(i16::from(*category))
            .bind(i16::from(*placement))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::PodiumPoolResidualForwarded {
            token,
            recipient,
            amount,
            category,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_podium_pool_residual_forwarded (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    token_address, recipient_address, amount, category
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*token))
            .bind(addr_hex(*recipient))
            .bind(u256_dec(*amount))
            .bind(i16::from(*category))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitEpochOpened {
            epoch_id,
            start_timestamp,
            end_timestamp,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_epoch_opened (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    epoch_id, start_timestamp, end_timestamp
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*epoch_id))
            .bind(u256_dec(*start_timestamp))
            .bind(u256_dec(*end_timestamp))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitHealthEpochFinalized {
            epoch_id,
            finalized_at,
            reserve_ratio_wad,
            doub_total_supply,
            repricing_factor_wad,
            backing_per_doubloon_wad,
            internal_state_e_wad,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_health_epoch_finalized (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    epoch_id, finalized_at, reserve_ratio_wad, doub_total_supply,
                    repricing_factor_wad, backing_per_doubloon_wad, internal_state_e_wad
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::numeric, $12::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*epoch_id))
            .bind(u256_dec(*finalized_at))
            .bind(u256_dec(*reserve_ratio_wad))
            .bind(u256_dec(*doub_total_supply))
            .bind(u256_dec(*repricing_factor_wad))
            .bind(u256_dec(*backing_per_doubloon_wad))
            .bind(u256_dec(*internal_state_e_wad))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitEpochReserveSnapshot {
            epoch_id,
            reserve_asset,
            balance,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_epoch_reserve_snapshot (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    epoch_id, reserve_asset, balance
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*epoch_id))
            .bind(addr_hex(*reserve_asset))
            .bind(u256_dec(*balance))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitReserveBalanceUpdated {
            reserve_asset,
            balance_after,
            delta,
            reason_code,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_reserve_balance_updated (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    reserve_asset, balance_after, delta, reason_code
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*reserve_asset))
            .bind(u256_dec(*balance_after))
            .bind(delta)
            .bind(*reason_code as i16)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitDeposit {
            user,
            reserve_asset,
            amount,
            doub_out,
            epoch_id,
            faction_id,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_deposit (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    user_address, reserve_asset, amount, doub_out, epoch_id, faction_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, $10::numeric, $11::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*user))
            .bind(addr_hex(*reserve_asset))
            .bind(u256_dec(*amount))
            .bind(u256_dec(*doub_out))
            .bind(u256_dec(*epoch_id))
            .bind(u256_dec(*faction_id))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitWithdrawal {
            user,
            reserve_asset,
            amount,
            doub_in,
            epoch_id,
            faction_id,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_withdrawal (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    user_address, reserve_asset, amount, doub_in, epoch_id, faction_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric, $10::numeric, $11::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*user))
            .bind(addr_hex(*reserve_asset))
            .bind(u256_dec(*amount))
            .bind(u256_dec(*doub_in))
            .bind(u256_dec(*epoch_id))
            .bind(u256_dec(*faction_id))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitFeeAccrued {
            asset,
            amount,
            cumulative_in_asset,
            epoch_id,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_fee_accrued (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    asset, amount, cumulative_in_asset, epoch_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*asset))
            .bind(u256_dec(*amount))
            .bind(u256_dec(*cumulative_in_asset))
            .bind(u256_dec(*epoch_id))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitRepricingApplied {
            epoch_id,
            repricing_factor_wad,
            prior_internal_price_wad,
            new_internal_price_wad,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_repricing_applied (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    epoch_id, repricing_factor_wad, prior_internal_price_wad, new_internal_price_wad
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*epoch_id))
            .bind(u256_dec(*repricing_factor_wad))
            .bind(u256_dec(*prior_internal_price_wad))
            .bind(u256_dec(*new_internal_price_wad))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitParamsUpdated {
            actor,
            param_name,
            old_value,
            new_value,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_params_updated (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    actor, param_name, old_value, new_value
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*actor))
            .bind(param_name)
            .bind(u256_dec(*old_value))
            .bind(u256_dec(*new_value))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::NftSeriesCreated {
            series_id,
            max_supply,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_nft_series_created (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    series_id, max_supply
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*series_id))
            .bind(u256_dec(*max_supply))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::NftMinted {
            token_id,
            series_id,
            to,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_nft_minted (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    token_id, series_id, to_address
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*token_id))
            .bind(u256_dec(*series_id))
            .bind(addr_hex(*to))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::FeeRouterSinksUpdated {
            actor,
            old_destinations,
            old_weights,
            new_destinations,
            new_weights,
        } => {
            let old_json = json!({
                "destinations": old_destinations.map(addr_hex),
                "weights": old_weights,
            })
            .to_string();
            let new_json = json!({
                "destinations": new_destinations.map(addr_hex),
                "weights": new_weights,
            })
            .to_string();
            sqlx::query(
                r#"INSERT INTO idx_fee_router_sinks_updated (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    actor, old_sinks_json, new_sinks_json
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*actor))
            .bind(&old_json)
            .bind(&new_json)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::FeeRouterFeesDistributed {
            token,
            amount,
            shares,
        } => {
            let shares_json = json!({
                "shares": shares.map(u256_dec),
            })
            .to_string();
            sqlx::query(
                r#"INSERT INTO idx_fee_router_fees_distributed (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    token, amount, shares_json
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*token))
            .bind(u256_dec(*amount))
            .bind(&shares_json)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::FeeRouterDistributableTokenUpdated {
            token,
            allowed,
            actor,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_fee_router_distributable_token_updated (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    token, allowed, actor
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*token))
            .bind(*allowed)
            .bind(addr_hex(*actor))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::FeeRouterERC20Rescued {
            token,
            recipient,
            amount,
            actor,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_fee_router_erc20_rescued (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    token, recipient, amount, actor
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*token))
            .bind(addr_hex(*recipient))
            .bind(u256_dec(*amount))
            .bind(addr_hex(*actor))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveBuyFeeRoutingEnabled { enabled } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy_fee_routing_enabled (
                    block_number, block_hash, tx_hash, log_index, contract_address, enabled
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(*enabled)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveCharmRedemptionEnabled { enabled } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_charm_redemption_enabled (
                    block_number, block_hash, tx_hash, log_index, contract_address, enabled
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(*enabled)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveReservePodiumPayoutsEnabled { enabled } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_reserve_podium_payouts_enabled (
                    block_number, block_hash, tx_hash, log_index, contract_address, enabled
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(*enabled)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveBuyRouterSet { router } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy_router_set (
                    block_number, block_hash, tx_hash, log_index, contract_address, router_address
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*router))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveDoubPresaleVestingSet { vesting } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_presale_vesting_set (
                    block_number, block_hash, tx_hash, log_index, contract_address, vesting_address
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*vesting))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveUnredeemedLaunchedTokenRecipientSet { recipient } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_unredeemed_launched_token_recipient_set (
                    block_number, block_hash, tx_hash, log_index, contract_address, recipient
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*recipient))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveUnredeemedLaunchedTokenSwept { recipient, amount } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_unredeemed_launched_token_swept (
                    block_number, block_hash, tx_hash, log_index, contract_address, recipient, amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*recipient))
            .bind(u256_dec(*amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurvePodiumResidualRecipientSet { recipient } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_podium_residual_recipient_set (
                    block_number, block_hash, tx_hash, log_index, contract_address, recipient
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*recipient))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveBuyRouterCl8ySurplus { amount } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy_router_cl8y_surplus (
                    block_number, block_hash, tx_hash, log_index, contract_address, amount
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveBuyRouterEthRescued { to, amount } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy_router_eth_rescued (
                    block_number, block_hash, tx_hash, log_index, contract_address, to_address, amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*to))
            .bind(u256_dec(*amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::TimeCurveBuyRouterErc20Rescued { token, to, amount } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy_router_erc20_rescued (
                    block_number, block_hash, tx_hash, log_index, contract_address, token, to_address, amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*token))
            .bind(addr_hex(*to))
            .bind(u256_dec(*amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::PodiumPoolPrizePusherSet { pusher } => {
            sqlx::query(
                r#"INSERT INTO idx_podium_pool_prize_pusher_set (
                    block_number, block_hash, tx_hash, log_index, contract_address, pusher
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*pusher))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitBurrowReserveBuckets {
            epoch_id,
            redeemable_backing,
            protocol_owned_backing,
            total_backing,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_burrow_reserve_buckets (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    epoch_id, redeemable_backing, protocol_owned_backing, total_backing
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*epoch_id))
            .bind(u256_dec(*redeemable_backing))
            .bind(u256_dec(*protocol_owned_backing))
            .bind(u256_dec(*total_backing))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitProtocolRevenueSplit {
            epoch_id,
            gross_amount,
            to_protocol_bucket,
            burned_amount,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_protocol_revenue_split (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    epoch_id, gross_amount, to_protocol_bucket, burned_amount
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*epoch_id))
            .bind(u256_dec(*gross_amount))
            .bind(u256_dec(*to_protocol_bucket))
            .bind(u256_dec(*burned_amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::RabbitWithdrawalFeeAccrued {
            asset,
            fee_amount,
            cumulative_withdraw_fees,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_rabbit_withdrawal_fee_accrued (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    asset, fee_amount, cumulative_withdraw_fees
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*asset))
            .bind(u256_dec(*fee_amount))
            .bind(u256_dec(*cumulative_withdraw_fees))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::DoubVestingStarted {
            start_timestamp,
            duration_sec,
            total_allocated,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_doub_vesting_started (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    start_timestamp, duration_sec, total_allocated
                ) VALUES ($1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(u256_dec(*start_timestamp))
            .bind(u256_dec(*duration_sec))
            .bind(u256_dec(*total_allocated))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::DoubVestingClaimed {
            beneficiary,
            amount,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_doub_vesting_claimed (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    beneficiary, amount
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*beneficiary))
            .bind(u256_dec(*amount))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::DoubVestingClaimsEnabled { enabled } => {
            sqlx::query(
                r#"INSERT INTO idx_doub_vesting_claims_enabled (
                    block_number, block_hash, tx_hash, log_index, contract_address, enabled
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(*enabled)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::DoubVestingRescueErc20 {
            token,
            recipient,
            amount,
            kind,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_doub_vesting_rescue_erc20 (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    token, recipient, amount, kind
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*token))
            .bind(addr_hex(*recipient))
            .bind(u256_dec(*amount))
            .bind(*kind as i16)
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::FeeSinkWithdrawn {
            token,
            recipient,
            amount,
            actor,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_fee_sink_withdrawn (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    token, recipient, amount, actor
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::numeric, $9)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*token))
            .bind(addr_hex(*recipient))
            .bind(u256_dec(*amount))
            .bind(addr_hex(*actor))
            .execute(&mut *conn)
            .await?;
        }
        DecodedEvent::Unknown { .. } => {}
    }

    Ok(())
}

/// Pool wrapper that **autocommits** one decoded log per call (`acquire` → insert → implicit `COMMIT`).
///
/// Hot-path block ingestion uses [`persist_decoded_log_conn`] inside a single SQL transaction per block
/// (GitLab #140 — **`INV-INDEXER-140`** in repo `docs/testing/invariants-and-business-logic.md`). Use this
/// only when **single-event** persistence is intentional (integration tests, one-off tools). For atomic
/// multi-log batches, open a SQL transaction on the pool and call [`persist_decoded_log_conn`] on that
/// connection (GitLab #148).
pub async fn persist_decoded_log_autocommit(pool: &PgPool, d: &DecodedLog) -> Result<()> {
    let mut conn = pool.acquire().await?;
    persist_decoded_log_conn(&mut conn, d).await
}

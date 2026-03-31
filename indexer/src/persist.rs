// SPDX-License-Identifier: AGPL-3.0-or-later

//! Insert decoded events (idempotent via ON CONFLICT).

use alloy_primitives::{Address, U256};
use eyre::Result;
use serde_json::json;
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

/// Persist a decoded log. Unknown events are skipped.
pub async fn persist_decoded_log(pool: &PgPool, d: &DecodedLog) -> Result<()> {
    let block = d.block_number as i64;
    let block_h = b256_hex(d.block_hash);
    let tx_h = b256_hex(d.tx_hash);
    let log_i = d.log_index as i32;
    let contract = addr_hex(d.contract);

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
            .execute(pool)
            .await?;
        }
        DecodedEvent::TimeCurveBuy {
            buyer,
            amount,
            current_min_buy,
            new_deadline,
            total_raised_after,
            buy_index,
        } => {
            sqlx::query(
                r#"INSERT INTO idx_timecurve_buy (
                    block_number, block_hash, tx_hash, log_index, contract_address,
                    buyer, amount, current_min_buy, new_deadline, total_raised_after, buy_index
                ) VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8::numeric, $9::numeric, $10::numeric, $11::numeric)
                ON CONFLICT (tx_hash, log_index) DO NOTHING"#,
            )
            .bind(block)
            .bind(&block_h)
            .bind(&tx_h)
            .bind(log_i)
            .bind(&contract)
            .bind(addr_hex(*buyer))
            .bind(u256_dec(*amount))
            .bind(u256_dec(*current_min_buy))
            .bind(u256_dec(*new_deadline))
            .bind(u256_dec(*total_raised_after))
            .bind(u256_dec(*buy_index))
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
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
            .execute(pool)
            .await?;
        }
        DecodedEvent::Unknown { .. } => {}
    }

    Ok(())
}

// SPDX-License-Identifier: AGPL-3.0-or-later

//! YieldOmega indexer library — shared by the `yieldomega-indexer` binary and integration tests.

pub mod api;
pub mod api_arena;
pub mod arena_podium_live;
pub mod arena_wallet_stats;
pub mod chain_timer;
pub mod config;
pub mod cors_config;
pub mod db;
pub mod decoder;
pub mod ingestion;
pub mod last_buy_epoch_head;
pub mod persist;
pub mod reorg;
pub mod rpc_http;
pub mod sale_state;
pub mod warbow_score;

mod rpc_poll_health;

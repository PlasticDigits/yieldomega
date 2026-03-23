use eyre::{Result, WrapErr};
use std::net::SocketAddr;

/// Runtime configuration for the indexer, loaded from environment variables.
///
/// The canonical variable names are documented in `.env.example`.
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub rpc_url: String,
    pub chain_id: u64,
    pub start_block: u64,
    pub listen_addr: SocketAddr,
}

impl Config {
    /// Load configuration from environment (reads `.env` first via dotenvy).
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok(); // missing .env is fine — CI uses real env vars

        Ok(Self {
            database_url: required("DATABASE_URL")?,
            rpc_url: required("RPC_URL")?,
            chain_id: required("CHAIN_ID")?
                .parse()
                .wrap_err("CHAIN_ID must be a u64")?,
            start_block: std::env::var("START_BLOCK")
                .unwrap_or_else(|_| "0".into())
                .parse()
                .wrap_err("START_BLOCK must be a u64")?,
            listen_addr: std::env::var("LISTEN_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:3100".into())
                .parse()
                .wrap_err("LISTEN_ADDR must be a valid socket address")?,
        })
    }
}

fn required(key: &str) -> Result<String> {
    std::env::var(key).wrap_err_with(|| format!("missing required env var: {key}"))
}

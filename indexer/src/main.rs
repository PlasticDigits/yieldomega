// SPDX-License-Identifier: AGPL-3.0-or-later

//! YieldOmega Indexer — offchain read model for MegaETH chain events.
//!
//! This binary is a **scaffold**. It wires configuration, Postgres migrations,
//! and HTTP API stubs. Actual event decoding and ingestion require contract
//! ABIs that do not yet exist; all domain interfaces are explicitly stubbed.

mod api;
mod config;
mod db;
mod decoder;
mod ingestion;
mod reorg;

use eyre::Result;

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "yieldomega_indexer=info,sqlx=warn".into()),
        )
        .init();

    let config = config::Config::from_env()?;
    tracing::info!(chain_id = config.chain_id, rpc = %config.rpc_url, "loaded config");

    let pool = db::connect_and_migrate(&config.database_url).await?;

    // Spawn the block ingestion loop in the background.
    let ingest_pool = pool.clone();
    let ingest_config = config.clone();
    let ingestion_handle = tokio::spawn(async move {
        if let Err(e) = ingestion::run(&ingest_pool, &ingest_config).await {
            tracing::error!(?e, "ingestion failed");
        }
    });

    // Start the HTTP API on the configured address.
    let state = api::AppState { pool };
    let app = api::router(state);
    let listener = tokio::net::TcpListener::bind(config.listen_addr).await?;
    tracing::info!(addr = %config.listen_addr, "API listening");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    ingestion_handle.abort();
    Ok(())
}

async fn shutdown_signal() {
    tokio::signal::ctrl_c()
        .await
        .expect("failed to listen for ctrl-c");
    tracing::info!("shutting down");
}

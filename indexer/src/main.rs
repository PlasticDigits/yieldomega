// SPDX-License-Identifier: AGPL-3.0-or-later

//! Binary entrypoint — see `lib.rs` for modules.

use eyre::Result;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use yieldomega_indexer::{api, config, db, ingestion};

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

    let ingest_pool = pool.clone();
    let ingest_config = config.clone();
    let ingestion_handle = tokio::spawn(async move {
        if let Err(e) = ingestion::run(&ingest_pool, &ingest_config).await {
            tracing::error!(?e, "ingestion failed");
        }
    });

    let state = api::AppState { pool };
    let app = api::router(state)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http());
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

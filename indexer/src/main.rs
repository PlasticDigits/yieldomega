// SPDX-License-Identifier: AGPL-3.0-or-later

//! Binary entrypoint — see `lib.rs` for modules.

use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::Arc;
use std::time::Duration;

use alloy_primitives::Address;
use eyre::Result;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use yieldomega_indexer::{
    api, chain_timer, config, cors_config, db, ingestion,
};

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
    let ingestion_progress = ingestion::IngestionProgress {
        ingestion_alive: Arc::new(AtomicBool::new(false)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(0)),
    };
    let ingest_progress = ingestion_progress.clone();
    let ingestion_handle = tokio::spawn(async move {
        let mut backoff = Duration::from_secs(1);
        const MAX_BACKOFF: Duration = Duration::from_secs(60);
        loop {
            match ingestion::run(&ingest_pool, &ingest_config, Some(&ingest_progress)).await {
                Ok(()) => {
                    tracing::warn!("ingestion::run returned Ok unexpectedly; resetting backoff");
                    backoff = Duration::from_secs(1);
                }
                Err(e) => {
                    tracing::error!(?e, "ingestion failed; backing off before retry");
                    tokio::time::sleep(backoff).await;
                    backoff = (backoff * 2).min(MAX_BACKOFF);
                }
            }
        }
    });

    let chain_timer_cache: Arc<RwLock<Option<chain_timer::TimecurveHeadSnapshot>>> =
        Arc::new(RwLock::new(None));

    let rpc_timeout = config.rpc_request_timeout;
    if let Some(addr) = config.address_registry.as_ref().and_then(|r| {
        let s = r.contracts.timecurve.trim();
        if s.is_empty() {
            return None;
        }
        s.parse::<Address>().ok()
    }) {
        let rpc = config.rpc_url.clone();
        let cache = chain_timer_cache.clone();
        tokio::spawn(async move {
            chain_timer::run_poll_loop(rpc, addr, cache, rpc_timeout).await;
        });
    } else {
        tracing::warn!(
            "ADDRESS_REGISTRY missing TimeCurve — /v1/timecurve/chain-timer will return 503"
        );
    }

    let state = api::AppState {
        pool,
        chain_timer: chain_timer_cache,
        ingestion_alive: ingestion_progress.ingestion_alive.clone(),
        last_indexed_at_ms: ingestion_progress.last_indexed_at_ms.clone(),
    };
    let app = api::router(state)
        .layer(cors_config::cors_layer_for_runtime()?)
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

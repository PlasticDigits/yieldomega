// SPDX-License-Identifier: AGPL-3.0-or-later

//! Binary entrypoint — see `lib.rs` for modules.

use std::net::SocketAddr;
use std::sync::atomic::{AtomicBool, AtomicU64};
use std::sync::Arc;
use std::time::Duration;

use alloy_primitives::Address;
use eyre::Result;
use tokio::sync::RwLock;
use tower_http::trace::TraceLayer;
use yieldomega_indexer::{api, chain_timer, config, cors_config, db, doub_spot_price, ingestion, rpc_metrics};

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
    config::warn_public_bind_without_production(config.listen_addr);
    tracing::info!(
        chain_id = config.chain_id,
        rpc_endpoints = config.rpc_urls.len(),
        rpc_primary = config.rpc_urls.first().map(String::as_str),
        "loaded config"
    );
    tracing::debug!(rpc_urls = ?config.rpc_urls, "RPC endpoint order");

    let pool = db::connect_and_migrate(&config.database_url, config.database_pool_max).await?;

    let rpc_metrics = rpc_metrics::RpcMetrics::new();
    let metrics_for_log = rpc_metrics.clone();
    tokio::spawn(async move {
        let interval = Duration::from_secs(
            std::env::var("INDEXER_RPC_METRICS_LOG_SEC")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(60),
        );
        loop {
            tokio::time::sleep(interval).await;
            let snap = metrics_for_log.snapshot();
            if snap.total_calls == 0 {
                continue;
            }
            tracing::info!(
                total_calls = snap.total_calls,
                calls_per_min_1m = snap.calls_per_min_1m,
                calls_per_min_5m = snap.calls_per_min_5m,
                peak_calls_10s = snap.peak_calls_10s,
                by_method = ?snap.by_method,
                by_caller = ?snap.by_caller,
                "indexer_rpc_metrics"
            );
        }
    });

    let ingest_pool = pool.clone();
    let ingest_config = config.clone();
    let ingest_metrics = rpc_metrics.clone();
    let ingestion_progress = ingestion::IngestionProgress {
        ingestion_alive: Arc::new(AtomicBool::new(false)),
        last_indexed_at_ms: Arc::new(AtomicU64::new(0)),
    };
    let ingest_progress = ingestion_progress.clone();
    let ingestion_handle = tokio::spawn(async move {
        let mut backoff = Duration::from_secs(1);
        const MAX_BACKOFF: Duration = Duration::from_secs(60);
        loop {
            match ingestion::run(
                &ingest_pool,
                &ingest_config,
                Some(&ingest_progress),
                &ingest_metrics,
            )
            .await
            {
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
    let doub_spot_price_cache: Arc<RwLock<Option<doub_spot_price::DoubSpotPriceSnapshot>>> =
        Arc::new(RwLock::new(None));

    let rpc_timeout = config.rpc_request_timeout;
    if let Some(addr) = config.address_registry.as_ref().and_then(|r| {
        let s = r.contracts.time_arena.trim();
        if s.is_empty() {
            return None;
        }
        s.parse::<Address>().ok()
    }) {
        let podium_vaults = config.address_registry.as_ref().and_then(|r| {
            let s = r.contracts.podium_vaults.trim();
            if s.is_empty() {
                return None;
            }
            s.parse::<Address>().ok()
        });
        let rpc_urls = config.rpc_urls.clone();
        let cache = chain_timer_cache.clone();
        let timer_metrics = rpc_metrics.clone();
        tokio::spawn(async move {
            chain_timer::run_poll_loop(
                &rpc_urls,
                addr,
                podium_vaults,
                cache,
                rpc_timeout,
                timer_metrics,
            )
            .await;
        });
    } else {
        tracing::warn!(
            "ADDRESS_REGISTRY missing TimeArena — /v1/arena/timers will return 503"
        );
    }

    let cl8y_addr = config.address_registry.as_ref().and_then(|r| {
        let cl8y = r.contracts.cl8y_reserve.trim();
        if cl8y.is_empty() {
            None
        } else {
            cl8y.parse::<Address>().ok()
        }
    });
    if let Some(kumbaya) =
        doub_spot_price::kumbaya_spot_config_from_env(config.chain_id, cl8y_addr)
    {
        let rpc_urls = config.rpc_urls.clone();
        let cache = doub_spot_price_cache.clone();
        let timer_cache = chain_timer_cache.clone();
        let spot_metrics = rpc_metrics.clone();
        tokio::spawn(async move {
            doub_spot_price::run_poll_loop(
                &rpc_urls,
                rpc_timeout,
                kumbaya,
                timer_cache,
                cache,
                spot_metrics,
            )
            .await;
        });
    } else {
        tracing::warn!(
            chain_id = config.chain_id,
            "Kumbaya spot config unavailable — /v1/arena/doub-spot-price will return 503"
        );
    }

    let time_arena_addr = config.address_registry.as_ref().and_then(|r| {
        let s = r.contracts.time_arena.trim();
        if s.is_empty() {
            return None;
        }
        s.parse::<Address>().ok()
    });
    let rpc_providers = match yieldomega_indexer::rpc_http::parse_http_rpc_urls(&config.rpc_urls)
        .and_then(|urls| {
            yieldomega_indexer::rpc_http::build_reqwest_providers(
                &urls,
                config.rpc_request_timeout,
            )
        }) {
        Ok(p) => Arc::new(p),
        Err(e) => {
            tracing::warn!(?e, "wallet-stats RPC providers unavailable");
            Arc::new(Vec::new())
        }
    };

    let state = api::AppState {
        pool,
        chain_timer: chain_timer_cache,
        doub_spot_price: doub_spot_price_cache,
        ingestion_alive: ingestion_progress.ingestion_alive.clone(),
        last_indexed_at_ms: ingestion_progress.last_indexed_at_ms.clone(),
        rpc_metrics,
        rpc_providers,
        time_arena: time_arena_addr,
    };
    let app = api::router_with_rate_limit(state)
        .layer(cors_config::cors_layer_for_runtime()?)
        .layer(TraceLayer::new_for_http());
    let listener = tokio::net::TcpListener::bind(config.listen_addr).await?;
    tracing::info!(addr = %config.listen_addr, "API listening");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
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

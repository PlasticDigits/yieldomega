// SPDX-License-Identifier: AGPL-3.0-or-later

//! Per-peer HTTP rate limiting via [`tower_governor`] ([GitLab #328](https://gitlab.com/PlasticDigits/yieldomega/-/issues/328)).

use std::num::NonZeroU32;
use std::time::Duration;

use axum::{
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Router,
};
use tower_governor::{
    governor::GovernorConfigBuilder,
    key_extractor::{PeerIpKeyExtractor, SmartIpKeyExtractor},
    GovernorLayer,
};

/// Default sustained rate: 600 requests/minute per peer (~10/s average).
pub const DEFAULT_RATE_LIMIT_PER_MIN: u32 = 600;
/// Default burst before 429 (page load with many parallel pollers).
pub const DEFAULT_RATE_LIMIT_BURST: u32 = 120;

/// Parsed rate-limit knobs from environment.
#[derive(Debug, Clone, Copy)]
pub struct RateLimitSettings {
    pub per_min: NonZeroU32,
    pub burst: NonZeroU32,
    pub trust_proxy: bool,
}

impl RateLimitSettings {
    /// Load from env. Returns `None` when disabled (`INDEXER_RATE_LIMIT_PER_MIN=0`).
    pub fn from_env() -> Option<Self> {
        let per_min_raw: u32 = std::env::var("INDEXER_RATE_LIMIT_PER_MIN")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_RATE_LIMIT_PER_MIN);
        if per_min_raw == 0 {
            return None;
        }
        let per_min = NonZeroU32::new(per_min_raw.max(1))?;
        let burst_raw: u32 = std::env::var("INDEXER_RATE_LIMIT_BURST")
            .ok()
            .and_then(|s| s.parse().ok())
            .unwrap_or(DEFAULT_RATE_LIMIT_BURST);
        let burst = NonZeroU32::new(burst_raw.max(1))?;
        let trust_proxy = std::env::var("INDEXER_TRUST_PROXY")
            .ok()
            .is_some_and(|s| matches!(s.trim().to_lowercase().as_str(), "1" | "true" | "yes"));
        Some(Self {
            per_min,
            burst,
            trust_proxy,
        })
    }
}

fn rate_limit_exceeded_response() -> Response {
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(header::CONTENT_TYPE, "application/json")],
        r#"{"error":"rate limit exceeded"}"#,
    )
        .into_response()
}

fn layer_with_extractor<S>(
    routes: Router<S>,
    settings: RateLimitSettings,
    trust_proxy: bool,
) -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    let replenish_ms = (60_000u64 / u64::from(settings.per_min.get())).max(1);
    let mut builder = GovernorConfigBuilder::default();
    builder
        .per_millisecond(replenish_ms)
        .burst_size(settings.burst.get());
    if trust_proxy {
        let mut keyed = builder.key_extractor(SmartIpKeyExtractor);
        let governor_conf = keyed.finish().expect("rate limit governor config");
        let limiter = governor_conf.limiter().clone();
        tokio::spawn(async move {
            let interval = Duration::from_secs(60);
            loop {
                tokio::time::sleep(interval).await;
                tracing::debug!(
                    storage_entries = limiter.len(),
                    "indexer rate limiter storage sweep"
                );
                limiter.retain_recent();
            }
        });
        return routes.layer(
            GovernorLayer::new(governor_conf).error_handler(|_| rate_limit_exceeded_response()),
        );
    }
    let mut keyed = builder.key_extractor(PeerIpKeyExtractor);
    let governor_conf = keyed.finish().expect("rate limit governor config");
    let limiter = governor_conf.limiter().clone();
    tokio::spawn(async move {
        let interval = Duration::from_secs(60);
        loop {
            tokio::time::sleep(interval).await;
            tracing::debug!(
                storage_entries = limiter.len(),
                "indexer rate limiter storage sweep"
            );
            limiter.retain_recent();
        }
    });
    routes.layer(
        GovernorLayer::new(governor_conf).error_handler(|_| rate_limit_exceeded_response()),
    )
}

/// Apply per-peer rate limiting to `routes` (typically all routes except `/healthz`).
pub fn apply_to_routes<S>(routes: Router<S>, settings: RateLimitSettings) -> Router<S>
where
    S: Clone + Send + Sync + 'static,
{
    layer_with_extractor(routes, settings, settings.trust_proxy)
}

/// Whether rate limiting is active for the running process.
pub fn enabled_from_env() -> bool {
    RateLimitSettings::from_env().is_some()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::SocketAddr;
    use axum::{body::Body, routing::get, Router};
    use http_body_util::BodyExt;
    use tower::ServiceExt;

    async fn ok_handler() -> &'static str {
        "ok"
    }

    #[test]
    fn from_env_disabled_when_zero() {
        std::env::set_var("INDEXER_RATE_LIMIT_PER_MIN", "0");
        assert!(RateLimitSettings::from_env().is_none());
        std::env::remove_var("INDEXER_RATE_LIMIT_PER_MIN");
    }

    #[test]
    fn from_env_defaults_when_unset() {
        std::env::remove_var("INDEXER_RATE_LIMIT_PER_MIN");
        std::env::remove_var("INDEXER_RATE_LIMIT_BURST");
        let s = RateLimitSettings::from_env().expect("defaults enabled");
        assert_eq!(s.per_min.get(), DEFAULT_RATE_LIMIT_PER_MIN);
        assert_eq!(s.burst.get(), DEFAULT_RATE_LIMIT_BURST);
    }

    #[tokio::test]
    async fn excess_requests_return_429() {
        std::env::set_var("INDEXER_RATE_LIMIT_PER_MIN", "60");
        std::env::set_var("INDEXER_RATE_LIMIT_BURST", "2");
        let settings = RateLimitSettings::from_env().expect("settings");
        let app = apply_to_routes(
            Router::new().route("/probe", get(ok_handler)),
            settings,
        );
        let peer = SocketAddr::from(([203, 0, 113, 1], 12345));
        for _ in 0..2 {
            let res = app
                .clone()
                .oneshot(
                    axum::http::Request::builder()
                        .uri("/probe")
                        .extension(axum::extract::ConnectInfo(peer))
                        .body(Body::empty())
                        .unwrap(),
                )
                .await
                .unwrap();
            assert_eq!(res.status(), StatusCode::OK);
        }
        let res = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/probe")
                    .extension(axum::extract::ConnectInfo(peer))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(res.status(), StatusCode::TOO_MANY_REQUESTS);
        let body = res.into_body().collect().await.unwrap().to_bytes();
        assert!(std::str::from_utf8(&body)
            .unwrap()
            .contains("rate limit exceeded"));
        std::env::remove_var("INDEXER_RATE_LIMIT_PER_MIN");
        std::env::remove_var("INDEXER_RATE_LIMIT_BURST");
    }
}

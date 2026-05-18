// SPDX-License-Identifier: AGPL-3.0-or-later

//! Shared JSON-RPC HTTP client wiring — bounded request latency for ingestion + chain timer.

use std::time::Duration;

use alloy_json_rpc::RpcError;
use alloy_provider::{ProviderBuilder, ReqwestProvider};
use alloy_rpc_client::RpcClient;
use alloy_transport::{HttpError, TransportError, TransportErrorKind, TransportResult};
use alloy_transport_http::Http;
use eyre::{bail, Result, WrapErr};

/// Build a [`ReqwestProvider`] using a [`reqwest::Client`] with a per-request timeout.
///
/// Without this, hung RPC calls can block the indexer indefinitely ([GitLab #168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)).
pub fn reqwest_http_provider(url: reqwest::Url, timeout: Duration) -> Result<ReqwestProvider> {
    let client = reqwest::Client::builder()
        .timeout(timeout)
        .build()
        .wrap_err("build reqwest HTTP client for RPC_URL")?;
    let http = Http::with_client(client, url);
    let is_local = http.guess_local();
    let rpc = RpcClient::new(http, is_local);
    Ok(ProviderBuilder::new().on_client(rpc))
}

/// Ordered endpoints from a comma-separated `RPC_URL` value (matches `VITE_RPC_URL` parsing).
pub fn split_comma_separated_urls(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(String::from)
        .collect()
}

pub fn parse_http_rpc_urls(strings: &[String]) -> Result<Vec<reqwest::Url>> {
    let mut out = Vec::with_capacity(strings.len());
    for s in strings {
        let u: reqwest::Url = s
            .parse()
            .wrap_err_with(|| format!("invalid RPC_URL entry (expected http/https URL): {s:?}"))?;
        if u.scheme() != "http" && u.scheme() != "https" {
            bail!("RPC_URL entry must use http or https scheme: {u}");
        }
        out.push(u);
    }
    Ok(out)
}

pub fn build_reqwest_providers(
    urls: &[reqwest::Url],
    timeout: Duration,
) -> Result<Vec<ReqwestProvider>> {
    urls.iter()
        .map(|u| reqwest_http_provider(u.clone(), timeout))
        .collect()
}

/// Try each provider in order (viem-style `fallback`, same order as frontend comma-separated RPC).
pub async fn rpc_first_ok<'a, T, F, Fut>(
    providers: &'a [ReqwestProvider],
    mut f: F,
) -> TransportResult<T>
where
    F: FnMut(&'a ReqwestProvider) -> Fut,
    Fut: std::future::Future<Output = TransportResult<T>>,
{
    let mut last_err: Option<TransportError> = None;
    for p in providers {
        match f(p).await {
            Ok(v) => return Ok(v),
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.expect("rpc_first_ok requires non-empty providers"))
}

/// Like [`rpc_first_ok`], but for RPC methods that return `Option<T>` (e.g. `eth_getBlockByNumber`).
///
/// **Important:** [`rpc_first_ok`] treats `Ok(None)` as success and stops — so the first URL that
/// returns JSON-RPC `null` prevents trying comma-separated fallbacks. This helper keeps calling
/// providers until one returns `Ok(Some(_))`, which fixes operators whose primary MegaETH endpoint
/// omits historical blocks while a secondary URL serves them.
pub async fn rpc_first_some<'a, T, F, Fut>(
    providers: &'a [ReqwestProvider],
    mut f: F,
) -> TransportResult<Option<T>>
where
    F: FnMut(&'a ReqwestProvider) -> Fut,
    Fut: std::future::Future<Output = TransportResult<Option<T>>>,
{
    let mut last_err: Option<TransportError> = None;
    for p in providers {
        match f(p).await {
            Ok(Some(v)) => return Ok(Some(v)),
            Ok(None) => {}
            Err(e) => last_err = Some(e),
        }
    }
    match last_err {
        Some(e) => Err(e),
        None => Ok(None),
    }
}

/// Like [`rpc_first_some`], but tries URLs in **sticky** order: start at `sticky_idx`, then wrap.
///
/// Updates `sticky_idx` to the provider that returned `Ok(Some(_))`. Ingestion uses this so
/// consecutive `eth_getBlockByNumber` calls prefer the **same** RPC replica; otherwise comma-separated
/// fallbacks can alternate between nodes with divergent parent hashes and spin forever on false reorgs.
pub async fn rpc_first_some_sticky<'a, T, F, Fut>(
    providers: &'a [ReqwestProvider],
    sticky_idx: &mut usize,
    mut f: F,
) -> TransportResult<Option<T>>
where
    F: FnMut(&'a ReqwestProvider) -> Fut,
    Fut: std::future::Future<Output = TransportResult<Option<T>>>,
{
    let n = providers.len();
    if n == 0 {
        return Ok(None);
    }
    let mut last_err: Option<TransportError> = None;
    let base = *sticky_idx % n;
    for off in 0..n {
        let i = (base + off) % n;
        match f(&providers[i]).await {
            Ok(Some(v)) => {
                *sticky_idx = i;
                return Ok(Some(v));
            }
            Ok(None) => {}
            Err(e) => last_err = Some(e),
        }
    }
    match last_err {
        Some(e) => Err(e),
        None => Ok(None),
    }
}

/// Like [`rpc_first_ok`], but prefers the same sticky URL ordering as [`rpc_first_some_sticky`].
pub async fn rpc_first_ok_sticky<'a, T, F, Fut>(
    providers: &'a [ReqwestProvider],
    sticky_idx: &mut usize,
    mut f: F,
) -> TransportResult<T>
where
    F: FnMut(&'a ReqwestProvider) -> Fut,
    Fut: std::future::Future<Output = TransportResult<T>>,
{
    let n = providers.len();
    assert!(n > 0, "rpc_first_ok_sticky requires non-empty providers");
    let mut last_err: Option<TransportError> = None;
    let base = *sticky_idx % n;
    for off in 0..n {
        let i = (base + off) % n;
        match f(&providers[i]).await {
            Ok(v) => {
                *sticky_idx = i;
                return Ok(v);
            }
            Err(e) => last_err = Some(e),
        }
    }
    Err(last_err.expect("rpc_first_ok_sticky: inner loop always tries ≥1 provider"))
}

pub fn transport_err_http_status(err: &TransportError) -> Option<u16> {
    match err {
        RpcError::Transport(TransportErrorKind::HttpError(HttpError { status, .. })) => {
            Some(*status)
        }
        _ => None,
    }
}

pub fn error_chain_has_transport_rpc(err: &(dyn std::error::Error + 'static)) -> bool {
    let mut cur = Some(err);
    while let Some(e) = cur {
        if e.downcast_ref::<RpcError<TransportErrorKind>>().is_some() {
            return true;
        }
        cur = e.source();
    }
    false
}

pub fn error_chain_transport_http_status(err: &(dyn std::error::Error + 'static)) -> Option<u16> {
    let mut cur = Some(err);
    while let Some(e) = cur {
        if let Some(te) = e.downcast_ref::<RpcError<TransportErrorKind>>() {
            if let Some(s) = transport_err_http_status(te) {
                return Some(s);
            }
        }
        cur = e.source();
    }
    None
}

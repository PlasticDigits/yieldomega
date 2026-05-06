// SPDX-License-Identifier: AGPL-3.0-or-later

//! Shared JSON-RPC HTTP client wiring — bounded request latency for ingestion + chain timer.

use std::time::Duration;

use alloy_provider::{ProviderBuilder, ReqwestProvider};
use alloy_rpc_client::RpcClient;
use alloy_transport_http::Http;
use eyre::{Result, WrapErr};

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

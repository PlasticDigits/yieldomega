// SPDX-License-Identifier: AGPL-3.0-or-later

//! CORS: permissive by default (local / staging). When **`INDEXER_PRODUCTION`** is truthy,
//! only origins listed in **`CORS_ALLOWED_ORIGINS`** (comma-separated) are reflected.

use eyre::{bail, Result, WrapErr};
use axum::http::HeaderValue;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

/// `INDEXER_PRODUCTION` truthy values (case-insensitive): `1`, `true`, `yes`.
pub fn indexer_production_enabled() -> bool {
    match std::env::var("INDEXER_PRODUCTION") {
        Ok(s) => matches!(s.to_lowercase().as_str(), "1" | "true" | "yes"),
        Err(_) => false,
    }
}

/// Parse a comma-separated list of `Origin` header values (e.g. `https://rpc.yieldomega.com`).
pub fn parse_allowed_origins(raw: &str) -> Result<Vec<HeaderValue>> {
    raw.split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| {
            HeaderValue::from_str(s).wrap_err_with(|| format!("invalid CORS origin {s:?}"))
        })
        .collect()
}

/// Build the CORS layer for the HTTP API.
///
/// - **Not production:** [`CorsLayer::permissive`].
/// - **Production (`INDEXER_PRODUCTION`):** require non-empty **`CORS_ALLOWED_ORIGINS`**. Preflight
///   is answered only for those origins (exact match).
pub fn cors_layer_for_runtime() -> Result<CorsLayer> {
    if !indexer_production_enabled() {
        return Ok(CorsLayer::permissive());
    }

    let raw = std::env::var("CORS_ALLOWED_ORIGINS").wrap_err(
        "INDEXER_PRODUCTION is set — set CORS_ALLOWED_ORIGINS to a comma-separated list of origins",
    )?;

    let origins = parse_allowed_origins(&raw)?;
    if origins.is_empty() {
        bail!("INDEXER_PRODUCTION requires non-empty CORS_ALLOWED_ORIGINS");
    }

    Ok(CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods(Any)
        .allow_headers(Any)
        .expose_headers(Any))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_two_https_origins() {
        let v = parse_allowed_origins("https://a.example, https://b.example ").unwrap();
        assert_eq!(v.len(), 2);
        assert_eq!(v[0].to_str().unwrap(), "https://a.example");
        assert_eq!(v[1].to_str().unwrap(), "https://b.example");
    }

    #[test]
    fn rejects_bad_origin() {
        assert!(parse_allowed_origins("https://evil.test/\0").is_err());
    }
}

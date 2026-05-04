// SPDX-License-Identifier: AGPL-3.0-or-later

use std::path::PathBuf;

use alloy_primitives::Address;
use eyre::{bail, Context, Result};
use serde::Deserialize;
use std::net::SocketAddr;

/// Substrings that must **not** appear in `DATABASE_URL` (case-insensitive) when
/// [`crate::cors_config::indexer_production_enabled`] is true.
///
/// **Keep in sync** with placeholders in `indexer/.env.example` and operator docs in
/// `indexer/README.md` ([GitLab #142](https://gitlab.com/PlasticDigits/yieldomega/-/issues/142)).
///
/// | Substring | Rationale |
/// |-----------|-----------|
/// | `change_me_before_deploy` | Documented template token — not a real credential. |
/// | `:password@` | Trivial password shipped in older examples (`user:password@host`). |
const FORBIDDEN_PRODUCTION_DATABASE_URL_SUBSTRINGS: &[&str] =
    &["change_me_before_deploy", ":password@"];

/// Return the first forbidden substring found in `database_url` (lowercased match), if any.
pub fn first_forbidden_production_database_url_substring(database_url: &str) -> Option<&'static str> {
    let lowered = database_url.to_lowercase();
    FORBIDDEN_PRODUCTION_DATABASE_URL_SUBSTRINGS
        .iter()
        .copied()
        .find(|sub| lowered.contains(sub))
}

/// Fail when `INDEXER_PRODUCTION` is set and `DATABASE_URL` still looks like a copy-pasted template.
pub fn ensure_production_database_url(database_url: &str) -> Result<()> {
    if !crate::cors_config::indexer_production_enabled() {
        return Ok(());
    }
    if let Some(sub) = first_forbidden_production_database_url_substring(database_url) {
        bail!(
            "INDEXER_PRODUCTION is set but DATABASE_URL contains forbidden placeholder substring {:?} — replace with a unique credential; see indexer/.env.example and indexer/README.md (GitLab #142)",
            sub
        );
    }
    Ok(())
}

/// Parsed `dev-addresses.json` (see contracts/deployments/dev-addresses.example.json).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddressRegistry {
    pub chain_id: u64,
    pub contracts: RegistryContracts,
    pub deploy_block: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RegistryContracts {
    #[serde(rename = "TimeCurve", default)]
    pub timecurve: String,
    /// Optional `TimeCurveBuyRouter` for `BuyViaKumbaya` logs (GitLab #67).
    #[serde(rename = "TimeCurveBuyRouter", default)]
    pub timecurve_buy_router: String,
    #[serde(rename = "RabbitTreasury", default)]
    pub rabbit_treasury: String,
    #[serde(rename = "LeprechaunNFT", default)]
    pub leprechaun_nft: String,
    #[serde(rename = "FeeRouter", default)]
    pub fee_router: String,
    #[serde(rename = "ReferralRegistry", default)]
    pub referral_registry: String,
    #[serde(rename = "PodiumPool", alias = "PrizeVault", default)]
    pub podium_pool: String,
}

impl AddressRegistry {
    /// Non-empty configured contract addresses for `eth_getLogs` filtering.
    pub fn index_addresses(&self) -> Vec<Address> {
        let mut v = Vec::new();
        for s in [
            self.contracts.timecurve.trim(),
            self.contracts.timecurve_buy_router.trim(),
            self.contracts.rabbit_treasury.trim(),
            self.contracts.leprechaun_nft.trim(),
            self.contracts.fee_router.trim(),
            self.contracts.referral_registry.trim(),
            self.contracts.podium_pool.trim(),
        ] {
            if s.is_empty() {
                continue;
            }
            if let Ok(a) = s.parse::<Address>() {
                v.push(a);
            } else {
                tracing::warn!(address = s, "skipping invalid address in registry");
            }
        }
        v
    }
}

/// Runtime configuration loaded from environment (and optional registry file).
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub rpc_url: String,
    pub chain_id: u64,
    /// From `START_BLOCK` env (default 0).
    pub start_block: u64,
    pub listen_addr: SocketAddr,
    pub address_registry: Option<AddressRegistry>,
    /// When false, ingestion task exits immediately (API only).
    pub ingestion_enabled: bool,
}

impl Config {
    /// Load configuration from environment (reads `.env` first via dotenvy).
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        let address_registry = match std::env::var("ADDRESS_REGISTRY_PATH") {
            Ok(p) => {
                let path = PathBuf::from(&p);
                let raw = std::fs::read_to_string(&path)
                    .wrap_err_with(|| format!("read ADDRESS_REGISTRY_PATH: {}", path.display()))?;
                let reg: AddressRegistry = serde_json::from_str(&raw)
                    .wrap_err_with(|| format!("parse address registry JSON: {}", path.display()))?;
                Some(reg)
            }
            Err(_) => None,
        };

        let start_block: u64 = std::env::var("START_BLOCK")
            .unwrap_or_else(|_| "0".into())
            .parse()
            .wrap_err("START_BLOCK must be a u64")?;

        let ingestion_enabled = match std::env::var("INGESTION_ENABLED") {
            Ok(s) => !matches!(s.to_lowercase().as_str(), "0" | "false" | "no"),
            Err(_) => true,
        };

        let chain_id: u64 = required("CHAIN_ID")?
            .parse()
            .wrap_err("CHAIN_ID must be a u64")?;

        if let Some(ref reg) = address_registry {
            if reg.chain_id != chain_id {
                tracing::warn!(
                    registry_chain = reg.chain_id,
                    config_chain = chain_id,
                    "chain id mismatch between ADDRESS_REGISTRY and CHAIN_ID"
                );
            }
        }

        let database_url = required("DATABASE_URL")?;
        ensure_production_database_url(&database_url)?;

        Ok(Self {
            database_url,
            rpc_url: required("RPC_URL")?,
            chain_id,
            start_block,
            listen_addr: std::env::var("LISTEN_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:3100".into())
                .parse()
                .wrap_err("LISTEN_ADDR must be a valid socket address")?,
            address_registry,
            ingestion_enabled,
        })
    }

    /// First block to index: `max(START_BLOCK, registry.deploy_block)`.
    pub fn effective_start_block(&self) -> u64 {
        let deploy = self
            .address_registry
            .as_ref()
            .map(|r| r.deploy_block)
            .unwrap_or(0);
        self.start_block.max(deploy)
    }
}

fn required(key: &str) -> Result<String> {
    std::env::var(key).wrap_err_with(|| format!("missing required env var: {key}"))
}

#[cfg(test)]
mod production_database_url_tests {
    use super::*;

    #[test]
    fn forbidden_substring_change_me_case_insensitive() {
        assert_eq!(
            first_forbidden_production_database_url_substring(
                "postgres://u:Change_Me_Before_Deploy@h/db",
            ),
            Some("change_me_before_deploy"),
        );
    }

    #[test]
    fn forbidden_substring_trivial_password_userinfo() {
        assert_eq!(
            first_forbidden_production_database_url_substring(
                "postgres://yieldomega:password@127.0.0.1/db",
            ),
            Some(":password@"),
        );
    }

    #[test]
    fn no_match_for_strong_credential() {
        assert_eq!(
            first_forbidden_production_database_url_substring(
                "postgres://yieldomega:hx7_kL9mN2pQ@127.0.0.1:5432/db",
            ),
            None,
        );
    }
}

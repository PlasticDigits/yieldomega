// SPDX-License-Identifier: AGPL-3.0-or-later

use std::path::PathBuf;
use std::time::Duration;

use alloy_primitives::Address;
use eyre::{bail, Context, Result};
use serde::Deserialize;
use std::net::SocketAddr;

use crate::rpc_http::split_comma_separated_urls;

/// MegaETH mainnet — aligned with `frontend/src/lib/chain.ts` (`MEGAETH_MAINNET_CHAIN_ID`).
const MEGAETH_MAINNET_CHAIN_ID: u64 = 4326;

/// Extra public endpoints appended after env URLs for MegaETH mainnet (same order/dedup as frontend).
const MEGAETH_MAINNET_PUBLIC_RPC_FALLBACKS: &[&str] = &[
    "https://rpc-megaeth-mainnet.globalstake.io",
];

fn megaeth_mainnet_ordered_rpc_urls(env_urls: &[String]) -> Vec<String> {
    let mut ordered = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for raw in env_urls
        .iter()
        .map(String::as_str)
        .chain(MEGAETH_MAINNET_PUBLIC_RPC_FALLBACKS.iter().copied())
    {
        let u = raw.trim();
        if u.is_empty() || seen.contains(u) {
            continue;
        }
        seen.insert(u.to_string());
        ordered.push(u.to_string());
    }
    ordered
}

/// Chains where **`deploy_block` may be zero** in production (local Anvil). All other chains
/// require a positive **`deploy_block`** so **`effective_start_block`** is not silently wrong.
///
/// MegaETH devnets **6342 / 6343** still require a real deploy anchor when **`INDEXER_PRODUCTION`**
/// is set — only **31337** skips this check ([GitLab #156](https://gitlab.com/PlasticDigits/yieldomega/-/issues/156)).
const PRODUCTION_OPTIONAL_DEPLOY_BLOCK_CHAIN_IDS: &[u64] = &[31337];

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
pub fn first_forbidden_production_database_url_substring(
    database_url: &str,
) -> Option<&'static str> {
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
    #[serde(rename = "TimeArena", default)]
    pub time_arena: String,
    /// Optional `TimeCurveBuyRouter` for legacy `BuyViaKumbaya` logs (GitLab #67).
    #[serde(rename = "TimeCurveBuyRouter", default)]
    pub timecurve_buy_router: String,
    #[serde(rename = "PodiumVaults", default)]
    pub podium_vaults: String,
    #[serde(rename = "AdminSellVault", default)]
    pub admin_sell_vault: String,
    #[serde(rename = "ReferralRegistry", default)]
    pub referral_registry: String,
}

impl AddressRegistry {
    /// Non-empty configured contract addresses for `eth_getLogs` filtering.
    pub fn index_addresses(&self) -> Vec<Address> {
        let mut v = Vec::new();
        for s in [
            self.contracts.time_arena.trim(),
            self.contracts.timecurve_buy_router.trim(),
            self.contracts.podium_vaults.trim(),
            self.contracts.admin_sell_vault.trim(),
            self.contracts.referral_registry.trim(),
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

/// Committed MegaETH mainnet address registry JSON (see `write-production-registry-from-broadcast.sh`).
/// When **`ADDRESS_REGISTRY_PATH`** is unset or empty, [`Config::from_env`] loads this file **only
/// if it exists** and its JSON **`chain_id`** equals **`CHAIN_ID`** from the environment (so local
/// dev with another `CHAIN_ID` does not silently pick up mainnet addresses).
const DEFAULT_ADDRESS_REGISTRY_FILE: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/address-registry.megaeth-mainnet.json"
);

fn load_address_registry_from_path(path: &PathBuf) -> Result<AddressRegistry> {
    let raw = std::fs::read_to_string(path)
        .wrap_err_with(|| format!("read address registry: {}", path.display()))?;
    serde_json::from_str(&raw)
        .wrap_err_with(|| format!("parse address registry JSON: {}", path.display()))
}

/// When **`INDEXER_PRODUCTION`** is enabled, validate registry vs **`CHAIN_ID`** and (when
/// ingestion is enabled) mandatory proxy addresses. See [`validate_address_registry_for_production`].
pub fn ensure_production_address_registry(
    chain_id: u64,
    ingestion_enabled: bool,
    address_registry: &Option<AddressRegistry>,
    require_buy_router: bool,
) -> Result<()> {
    if !crate::cors_config::indexer_production_enabled() {
        return Ok(());
    }

    if ingestion_enabled && address_registry.is_none() {
        bail!(
            "INDEXER_PRODUCTION with INGESTION_ENABLED requires an address registry — \
             set ADDRESS_REGISTRY_PATH, or ship the committed default file at {} (GitLab #156)",
            DEFAULT_ADDRESS_REGISTRY_FILE
        );
    }

    let Some(reg) = address_registry else {
        return Ok(());
    };

    validate_address_registry_for_production(reg, chain_id, ingestion_enabled, require_buy_router)
}

/// Fail closed on misconfigured **`ADDRESS_REGISTRY`** JSON when **`INDEXER_PRODUCTION`** is on.
///
/// - **`ingestion_enabled`:** mandatory protocol fields must be non-empty, parseable **ERC-20
///   sized** addresses, and **non-zero**; resolved log filter set must be non-empty; optional
///   **`TimeCurveBuyRouter`** is required when **`require_buy_router`** is true.
/// - **Always (when this is called for a `Some` registry):** `registry.chain_id` must match
///   **`CHAIN_ID`**; any **non-empty** contract string must parse (no silent skip).
pub fn validate_address_registry_for_production(
    reg: &AddressRegistry,
    chain_id: u64,
    ingestion_enabled: bool,
    require_buy_router: bool,
) -> Result<()> {
    if reg.chain_id != chain_id {
        bail!(
            "ADDRESS_REGISTRY chain_id {} does not match CHAIN_ID {} — fix registry JSON or CHAIN_ID (GitLab #156)",
            reg.chain_id,
            chain_id
        );
    }

    let strict_parse = |field: &str, raw: &str| -> Result<Address> {
        let s = raw.trim();
        if s.is_empty() {
            bail!("INDEXER_PRODUCTION: {field} is empty in ADDRESS_REGISTRY");
        }
        let a: Address = s.parse().wrap_err_with(|| {
            format!("INDEXER_PRODUCTION: {field} is not a valid address: {s:?}")
        })?;
        if a == Address::ZERO {
            bail!("INDEXER_PRODUCTION: {field} must not be the zero address");
        }
        Ok(a)
    };

    let parse_optional_buy_router = |raw: &str| -> Result<Option<Address>> {
        let s = raw.trim();
        if s.is_empty() {
            if require_buy_router {
                bail!(
                    "INDEXER_PRODUCTION: TimeCurveBuyRouter is required — set INDEXER_REGISTRY_REQUIRE_BUY_ROUTER=0 to allow omission, or add the router proxy to ADDRESS_REGISTRY (GitLab #156, GitLab #67)"
                );
            }
            return Ok(None);
        }
        let a: Address = s.parse().wrap_err_with(|| {
            format!("INDEXER_PRODUCTION: TimeCurveBuyRouter is not a valid address: {s:?}")
        })?;
        if a == Address::ZERO {
            bail!("INDEXER_PRODUCTION: TimeCurveBuyRouter must not be the zero address");
        }
        Ok(Some(a))
    };

    // Non-empty garbage in any field must not be silently skipped in production.
    for (field, raw) in [
        ("TimeArena", reg.contracts.time_arena.as_str()),
        (
            "TimeCurveBuyRouter",
            reg.contracts.timecurve_buy_router.as_str(),
        ),
        ("PodiumVaults", reg.contracts.podium_vaults.as_str()),
        ("AdminSellVault", reg.contracts.admin_sell_vault.as_str()),
        ("ReferralRegistry", reg.contracts.referral_registry.as_str()),
    ] {
        let s = raw.trim();
        if s.is_empty() {
            continue;
        }
        let _: Address = s.parse().wrap_err_with(|| {
            format!("INDEXER_PRODUCTION: {field} is not a valid address: {s:?}")
        })?;
    }

    if !ingestion_enabled {
        return Ok(());
    }

    let _ = strict_parse("TimeArena", &reg.contracts.time_arena)?;
    let _ = strict_parse("PodiumVaults", &reg.contracts.podium_vaults)?;
    let _ = strict_parse("AdminSellVault", &reg.contracts.admin_sell_vault)?;
    let _ = strict_parse("ReferralRegistry", &reg.contracts.referral_registry)?;
    let _ = parse_optional_buy_router(&reg.contracts.timecurve_buy_router)?;

    if !PRODUCTION_OPTIONAL_DEPLOY_BLOCK_CHAIN_IDS.contains(&chain_id) && reg.deploy_block == 0 {
        bail!(
            "INDEXER_PRODUCTION: deploy_block is 0 in ADDRESS_REGISTRY for chain_id {} — set the deployment anchor block (GitLab #156)",
            chain_id
        );
    }

    let addrs = reg.index_addresses();
    if addrs.is_empty() {
        bail!(
            "INDEXER_PRODUCTION: no contract addresses resolved for eth_getLogs — check ADDRESS_REGISTRY (GitLab #156)"
        );
    }

    Ok(())
}

fn registry_require_buy_router_from_env() -> bool {
    match std::env::var("INDEXER_REGISTRY_REQUIRE_BUY_ROUTER") {
        Ok(s) => matches!(s.to_lowercase().as_str(), "1" | "true" | "yes"),
        Err(_) => false,
    }
}

/// Runtime configuration loaded from environment (and optional registry file).
#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    /// Ordered JSON-RPC HTTP endpoints (`RPC_URL` comma-separated; MegaETH mainnet appends public fallbacks).
    pub rpc_urls: Vec<String>,
    pub chain_id: u64,
    /// From `START_BLOCK` env (default 0).
    pub start_block: u64,
    pub listen_addr: SocketAddr,
    pub address_registry: Option<AddressRegistry>,
    /// When false, ingestion task exits immediately (API only).
    pub ingestion_enabled: bool,
    /// HTTP JSON-RPC per-request timeout (ingestion + chain-timer poller), from
    /// `INDEXER_RPC_REQUEST_TIMEOUT_SEC` ([GitLab #168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)).
    pub rpc_request_timeout: Duration,
    /// sqlx Postgres pool size from `DATABASE_POOL_MAX` (default [`DEFAULT_DATABASE_POOL_MAX`]).
    pub database_pool_max: u32,
}

impl Config {
    /// Load configuration from environment (reads `.env` first via dotenvy).
    pub fn from_env() -> Result<Self> {
        dotenvy::dotenv().ok();

        let chain_id: u64 = required("CHAIN_ID")?
            .parse()
            .wrap_err("CHAIN_ID must be a u64")?;

        let address_registry = match std::env::var("ADDRESS_REGISTRY_PATH") {
            Ok(p) if !p.trim().is_empty() => {
                let path = PathBuf::from(p.trim());
                Some(load_address_registry_from_path(&path)?)
            }
            _ => {
                let path = PathBuf::from(DEFAULT_ADDRESS_REGISTRY_FILE);
                if path.exists() {
                    let reg = load_address_registry_from_path(&path)?;
                    if reg.chain_id == chain_id {
                        tracing::info!(
                            path = %path.display(),
                            "loaded default address registry (ADDRESS_REGISTRY_PATH unset)"
                        );
                        Some(reg)
                    } else {
                        tracing::warn!(
                            registry_chain = reg.chain_id,
                            config_chain = chain_id,
                            path = %path.display(),
                            "skipping default address registry (CHAIN_ID mismatch; set ADDRESS_REGISTRY_PATH explicitly)"
                        );
                        None
                    }
                } else {
                    None
                }
            }
        };

        let start_block: u64 = std::env::var("START_BLOCK")
            .unwrap_or_else(|_| "0".into())
            .parse()
            .wrap_err("START_BLOCK must be a u64")?;

        let ingestion_enabled = match std::env::var("INGESTION_ENABLED") {
            Ok(s) => !matches!(s.to_lowercase().as_str(), "0" | "false" | "no"),
            Err(_) => true,
        };

        let require_buy_router = registry_require_buy_router_from_env();
        ensure_production_address_registry(
            chain_id,
            ingestion_enabled,
            &address_registry,
            require_buy_router,
        )?;

        if let Some(ref reg) = address_registry {
            if reg.chain_id != chain_id && !crate::cors_config::indexer_production_enabled() {
                tracing::warn!(
                    registry_chain = reg.chain_id,
                    config_chain = chain_id,
                    "chain id mismatch between ADDRESS_REGISTRY and CHAIN_ID"
                );
            }
        }

        let database_url = required("DATABASE_URL")?;
        ensure_production_database_url(&database_url)?;

        let rpc_request_timeout = parse_rpc_request_timeout()?;
        let database_pool_max = parse_database_pool_max()?;

        let rpc_raw = required("RPC_URL")?;
        let mut rpc_urls: Vec<String> = split_comma_separated_urls(&rpc_raw);
        if rpc_urls.is_empty() {
            bail!("RPC_URL must list at least one http(s) endpoint (comma-separated allowed)");
        }
        if chain_id == MEGAETH_MAINNET_CHAIN_ID {
            rpc_urls = megaeth_mainnet_ordered_rpc_urls(&rpc_urls);
        }

        Ok(Self {
            database_url,
            rpc_urls,
            chain_id,
            start_block,
            listen_addr: std::env::var("LISTEN_ADDR")
                .unwrap_or_else(|_| "127.0.0.1:3100".into())
                .parse()
                .wrap_err("LISTEN_ADDR must be a valid socket address")?,
            address_registry,
            ingestion_enabled,
            rpc_request_timeout,
            database_pool_max,
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

/// Default sqlx Postgres pool size when `DATABASE_POOL_MAX` is unset.
pub const DEFAULT_DATABASE_POOL_MAX: u32 = 25;
/// Maximum configurable pool size (keep `instances × DATABASE_POOL_MAX` under Postgres limits).
const MAX_DATABASE_POOL_MAX: u32 = 100;

/// Default HTTP RPC timeout (seconds). Bounds hung TCP/RPC calls ([GitLab #168](https://gitlab.com/PlasticDigits/yieldomega/-/issues/168)).
const DEFAULT_RPC_REQUEST_TIMEOUT_SECS: u64 = 5;
/// Maximum configurable HTTP RPC timeout (seconds).
const MAX_RPC_REQUEST_TIMEOUT_SECS: u64 = 120;

fn parse_database_pool_max() -> Result<u32> {
    let n: u32 = match std::env::var("DATABASE_POOL_MAX") {
        Ok(s) => s
            .parse()
            .wrap_err("DATABASE_POOL_MAX must be a base-10 u32")?,
        Err(_) => DEFAULT_DATABASE_POOL_MAX,
    };
    if n == 0 {
        bail!("DATABASE_POOL_MAX must be at least 1");
    }
    Ok(n.min(MAX_DATABASE_POOL_MAX))
}

fn parse_rpc_request_timeout() -> Result<Duration> {
    let secs: u64 = match std::env::var("INDEXER_RPC_REQUEST_TIMEOUT_SEC") {
        Ok(s) => s
            .parse()
            .wrap_err("INDEXER_RPC_REQUEST_TIMEOUT_SEC must be a base-10 u64 (seconds)")?,
        Err(_) => DEFAULT_RPC_REQUEST_TIMEOUT_SECS,
    };
    if secs == 0 {
        bail!("INDEXER_RPC_REQUEST_TIMEOUT_SEC must be at least 1");
    }
    let secs = secs.min(MAX_RPC_REQUEST_TIMEOUT_SECS);
    Ok(Duration::from_secs(secs))
}

#[cfg(test)]
mod database_pool_max_tests {
    use super::*;

    #[test]
    fn default_when_unset() {
        std::env::remove_var("DATABASE_POOL_MAX");
        assert_eq!(parse_database_pool_max().unwrap(), DEFAULT_DATABASE_POOL_MAX);
    }

    #[test]
    fn parses_and_clamps_high() {
        std::env::set_var("DATABASE_POOL_MAX", "200");
        assert_eq!(parse_database_pool_max().unwrap(), MAX_DATABASE_POOL_MAX);
        std::env::remove_var("DATABASE_POOL_MAX");
    }

    #[test]
    fn rejects_zero() {
        std::env::set_var("DATABASE_POOL_MAX", "0");
        assert!(parse_database_pool_max().is_err());
        std::env::remove_var("DATABASE_POOL_MAX");
    }
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

#[cfg(test)]
mod production_registry_validation_tests {
    use super::*;

    const ADDR_A: &str = "0x1111111111111111111111111111111111111111";
    const ADDR_B: &str = "0x2222222222222222222222222222222222222222";

    fn filled_contracts(buy_router: &str) -> RegistryContracts {
        RegistryContracts {
            time_arena: ADDR_A.into(),
            timecurve_buy_router: buy_router.into(),
            podium_vaults: ADDR_A.into(),
            admin_sell_vault: ADDR_A.into(),
            referral_registry: ADDR_A.into(),
        }
    }

    fn reg(chain_id: u64, deploy_block: u64, contracts: RegistryContracts) -> AddressRegistry {
        AddressRegistry {
            chain_id,
            contracts,
            deploy_block,
        }
    }

    #[test]
    fn rejects_registry_chain_id_mismatch() {
        let r = reg(1, 100, filled_contracts(""));
        let e = validate_address_registry_for_production(&r, 2, true, false).unwrap_err();
        assert!(
            e.to_string().contains("CHAIN_ID"),
            "unexpected error: {e:?}"
        );
    }

    #[test]
    fn rejects_invalid_address_when_non_empty() {
        let mut c = filled_contracts("");
        c.time_arena = "not-an-address".into();
        let r = reg(1, 100, c);
        assert!(validate_address_registry_for_production(&r, 1, false, false).is_err());
    }

    #[test]
    fn rejects_empty_mandatory_when_ingestion() {
        let mut c = filled_contracts("");
        c.podium_vaults = "  ".into();
        let r = reg(1, 100, c);
        let e = validate_address_registry_for_production(&r, 1, true, false).unwrap_err();
        assert!(e.to_string().contains("PodiumVaults"), "{e:?}");
    }

    #[test]
    fn rejects_zero_mandatory_when_ingestion() {
        let mut c = filled_contracts("");
        c.time_arena = Address::ZERO.to_string();
        let r = reg(1, 100, c);
        assert!(validate_address_registry_for_production(&r, 1, true, false).is_err());
    }

    #[test]
    fn rejects_deploy_block_zero_on_non_local_chain_with_ingestion() {
        let r = reg(4326, 0, filled_contracts(""));
        let e = validate_address_registry_for_production(&r, 4326, true, false).unwrap_err();
        assert!(e.to_string().contains("deploy_block"), "{e:?}");
    }

    #[test]
    fn allows_deploy_block_zero_on_anvil_chain_with_ingestion() {
        let r = reg(31337, 0, filled_contracts(""));
        validate_address_registry_for_production(&r, 31337, true, false).unwrap();
    }

    #[test]
    fn rejects_empty_index_set_when_all_mandatory_unparseable_ingestion() {
        let c = RegistryContracts {
            time_arena: "nope".into(),
            timecurve_buy_router: String::new(),
            podium_vaults: "nope2".into(),
            admin_sell_vault: String::new(),
            referral_registry: String::new(),
        };
        let r = reg(1, 1, c);
        assert!(validate_address_registry_for_production(&r, 1, true, false).is_err());
    }

    #[test]
    fn require_buy_router_missing_fails() {
        let r = reg(1, 1, filled_contracts(""));
        let e = validate_address_registry_for_production(&r, 1, true, true).unwrap_err();
        assert!(
            e.to_string().contains("TimeCurveBuyRouter"),
            "unexpected: {e:?}"
        );
    }

    #[test]
    fn require_buy_router_present_ok() {
        let r = reg(1, 1, filled_contracts(ADDR_B));
        validate_address_registry_for_production(&r, 1, true, true).unwrap();
    }

    #[test]
    fn api_only_skips_mandatory_addresses_but_still_validates_nonempty_fields() {
        let mut c = RegistryContracts {
            time_arena: String::new(),
            timecurve_buy_router: String::new(),
            podium_vaults: String::new(),
            admin_sell_vault: String::new(),
            referral_registry: String::new(),
        };
        c.time_arena = "bogus".into();
        let r = reg(5, 0, c);
        assert!(validate_address_registry_for_production(&r, 5, false, false).is_err());
    }
}

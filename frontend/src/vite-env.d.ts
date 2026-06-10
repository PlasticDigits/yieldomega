/// <reference types="vite/client" />

// SPDX-License-Identifier: AGPL-3.0-only

interface ImportMetaEnv {
  /** Optional public site origin for absolute Open Graph / Twitter URLs (no trailing slash), e.g. https://app.example.com */
  readonly VITE_SITE_URL?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  /** Set to "1" to log each JSON-RPC attempt and fallback switches in the browser console. */
  readonly VITE_RPC_DEBUG?: string;
  readonly VITE_INDEXER_URL: string;
  /** Arena v2 `TimeArena` proxy (required — GitLab #266). */
  readonly VITE_TIME_ARENA_ADDRESS: string;
  readonly VITE_PODIUM_VAULTS_ADDRESS: string;
  readonly VITE_ADMIN_SELL_VAULT_ADDRESS: string;
  readonly VITE_REFERRAL_REGISTRY_ADDRESS: string;
  /** Set to "1" only for Playwright Anvil E2E (mock wallet). */
  readonly VITE_E2E_MOCK_WALLET: string;
  /** Optional: third-party Kumbaya DEX (e.g. pool page on external AMM). */
  readonly VITE_KUMBAYA_DEX_URL?: string;
  /** Kumbaya v3–compatible router (issue #41); required for ETH/USDM entry on this chain. */
  readonly VITE_KUMBAYA_SWAP_ROUTER?: string;
  /** Same contract as router on Anvil fixture, or protocol QuoterV2 on prod. */
  readonly VITE_KUMBAYA_QUOTER?: string;
  readonly VITE_KUMBAYA_WETH?: string;
  readonly VITE_KUMBAYA_USDM?: string;
  readonly VITE_KUMBAYA_CL8Y?: string;
  readonly VITE_KUMBAYA_FEE_DOUB_CL8Y?: string;
  readonly VITE_KUMBAYA_FEE_CL8Y_WETH?: string;
  readonly VITE_KUMBAYA_FEE_USDM_WETH?: string;
  /** TimeArenaBuyRouter for Kumbaya single-tx buys (#251). */
  readonly VITE_KUMBAYA_TIME_ARENA_BUY_ROUTER?: string;
  readonly VITE_GOVERNANCE_URL?: string;
  readonly VITE_EXPLORER_BASE_URL?: string;
  readonly VITE_CHAIN_NAME?: string;
  readonly VITE_DOTMEGA_REGISTRY_ADDRESS?: string;
  readonly VITE_SIR_DEX_URL?: string;
  readonly VITE_LAUNCH_TIMESTAMP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

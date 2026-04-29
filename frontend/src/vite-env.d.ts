/// <reference types="vite/client" />

// SPDX-License-Identifier: AGPL-3.0-only

interface ImportMetaEnv {
  /** Optional public site origin for absolute Open Graph / Twitter URLs (no trailing slash), e.g. https://app.example.com */
  readonly VITE_SITE_URL?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_INDEXER_URL: string;
  readonly VITE_TIMECURVE_ADDRESS: string;
  readonly VITE_RABBIT_TREASURY_ADDRESS: string;
  readonly VITE_LEPRECHAUN_NFT_ADDRESS: string;
  /** `DoubPresaleVesting` ERC-1967 proxy for `/vesting` (GitLab #92). */
  readonly VITE_DOUB_PRESALE_VESTING_ADDRESS?: string;
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
  readonly VITE_KUMBAYA_FEE_CL8Y_WETH?: string;
  readonly VITE_KUMBAYA_FEE_USDM_WETH?: string;
  /** Optional: third-party Sir levs DEX. */
  readonly VITE_SIR_DEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

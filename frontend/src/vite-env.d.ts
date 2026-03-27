/// <reference types="vite/client" />

// SPDX-License-Identifier: AGPL-3.0-only

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_INDEXER_URL: string;
  readonly VITE_TIMECURVE_ADDRESS: string;
  readonly VITE_RABBIT_TREASURY_ADDRESS: string;
  readonly VITE_LEPRECHAUN_NFT_ADDRESS: string;
  /** Set to "1" only for Playwright Anvil E2E (mock wallet). */
  readonly VITE_E2E_MOCK_WALLET: string;
  /** Optional: third-party Kumbaya DEX (e.g. pool page on external AMM). */
  readonly VITE_KUMBAYA_DEX_URL?: string;
  /** Optional: third-party Sir levs DEX. */
  readonly VITE_SIR_DEX_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

// SPDX-License-Identifier: AGPL-3.0-only

interface ImportMetaEnv {
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_INDEXER_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// SPDX-License-Identifier: AGPL-3.0-only

import { isAddress } from "viem";

function explorerBaseUrl(): string {
  const raw = import.meta.env.VITE_EXPLORER_BASE_URL?.trim() || "https://mega.etherscan.io";
  return raw.replace(/\/$/, "");
}

/** Public transaction URL. Defaults to MegaETH Etherscan; `VITE_EXPLORER_BASE_URL` can override. */
export function explorerTxUrl(hash: string): string | undefined {
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return undefined;
  }
  const base = explorerBaseUrl();
  return `${base}/tx/${hash}`;
}

/** Public address detail URL (EOA or contract). Same base as {@link explorerTxUrl}; invalid / non-address input returns `undefined`. */
export function explorerAddressUrl(address: string): string | undefined {
  const a = address.trim();
  if (!isAddress(a as `0x${string}`)) {
    return undefined;
  }
  const base = explorerBaseUrl();
  return `${base}/address/${a}`;
}

// SPDX-License-Identifier: AGPL-3.0-only

/** Public transaction URL. Defaults to MegaETH Etherscan; `VITE_EXPLORER_BASE_URL` can override. */
export function explorerTxUrl(hash: string): string | undefined {
  const raw = import.meta.env.VITE_EXPLORER_BASE_URL?.trim() || "https://mega.etherscan.io";
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    return undefined;
  }
  const base = raw.replace(/\/$/, "");
  return `${base}/tx/${hash}`;
}

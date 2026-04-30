// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Builds an address detail URL on MegaETH's Etherscan deployment.
 *
 * Intended for UX links that should always land on **one** recognizable explorer shell
 * ([`mega.etherscan.io`](https://mega.etherscan.io)) including local Anvil QA (GitLab #93).
 * This is separate from [`explorerTxUrl`](./explorer.ts) which follows `VITE_EXPLORER_BASE_URL`.
 */
export function megaEtherscanAddressUrl(address: string): string | undefined {
  const a = address.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(a)) {
    return undefined;
  }
  return `https://mega.etherscan.io/address/${a}`;
}

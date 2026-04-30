// SPDX-License-Identifier: AGPL-3.0-only

import { explorerAddressUrl } from "./explorer";

/**
 * Address detail URL for explorer UX (GitLab #93 fee sinks + GitLab #98 canonical display).
 * Delegates to [`explorerAddressUrl`](./explorer.ts): same **`VITE_EXPLORER_BASE_URL`** as tx links
 * (default [`mega.etherscan.io`](https://mega.etherscan.io)).
 */
export function megaEtherscanAddressUrl(address: string): string | undefined {
  return explorerAddressUrl(address);
}

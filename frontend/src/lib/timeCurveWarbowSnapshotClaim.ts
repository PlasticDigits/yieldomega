// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Legacy Arena hook for surfacing a permissionless `refreshWarbowPodium` CTA when ladder reads lagged `battlePoints`.
 * **GitLab #172** removed automatic onchain podium maintenance and `refreshWarbowPodium`; post-end governance uses
 * `finalizeWarbowPodium(first, second, third)` only — see `/timecurve/protocol` and invariants **`INV-WARBOW-172-*`**.
 */
export function viewerShouldSuggestWarBowPodiumRefresh(_args: {
  viewer?: `0x${string}`;
  viewerBp?: bigint;
  podiumWallets: readonly `0x${string}`[];
  podiumValues: readonly bigint[];
  saleEnded: boolean;
}): boolean {
  return false;
}

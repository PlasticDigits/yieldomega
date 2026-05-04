// SPDX-License-Identifier: AGPL-3.0-only

import { sameAddress } from "@/lib/addressFormat";

const ZERO = "0x0000000000000000000000000000000000000000";

/**
 * Rare drift: `_warbowPodium` snapshot can disagree with live `battlePoints` (permissionless refresh path — GitLab #129).
 * Heuristic: suggest `refreshWarbowPodium([...])` when the viewer is missing from the advertised top‑3 despite BP
 * that should beat third place / incomplete board / value mismatch — consult onchain ladder for payouts.
 */
export function viewerShouldSuggestWarBowPodiumRefresh(args: {
  viewer?: `0x${string}`;
  viewerBp?: bigint;
  podiumWallets: readonly `0x${string}`[];
  podiumValues: readonly bigint[];
  saleEnded: boolean;
}): boolean {
  const { viewer, viewerBp, podiumWallets, podiumValues, saleEnded } = args;
  // Post-end steals are forbidden; UX targets the live sale window.
  if (saleEnded) {
    return false;
  }
  if (!viewer || viewerBp === undefined || viewerBp <= 0n) {
    return false;
  }
  if (podiumWallets.length < 3 || podiumValues.length < 3) {
    return false;
  }

  for (let i = 0; i < 3; i += 1) {
    const w = podiumWallets[i];
    if (sameAddress(w, viewer)) {
      const shown = podiumValues[i] ?? 0n;
      return shown !== viewerBp;
    }
  }

  const w3 = podiumWallets[2];
  const v3 = podiumValues[2] ?? 0n;
  if (!w3 || sameAddress(w3, ZERO)) {
    return true;
  }
  return viewerBp > v3;
}

/** Calldata superset: connected wallet + current snapshot holders (zeros skipped by the contract). */
export function warBowRefreshCandidateAddresses(args: {
  viewer?: `0x${string}`;
  podiumWallets: readonly `0x${string}`[];
}): readonly `0x${string}`[] {
  const { viewer, podiumWallets } = args;
  const out: `0x${string}`[] = [];
  const seen = new Set<string>();
  const push = (a: `0x${string}` | undefined) => {
    if (!a || sameAddress(a, ZERO)) {
      return;
    }
    const k = a.toLowerCase();
    if (seen.has(k)) {
      return;
    }
    seen.add(k);
    out.push(a);
  };
  push(viewer);
  for (const w of podiumWallets) {
    push(w);
  }
  return out;
}

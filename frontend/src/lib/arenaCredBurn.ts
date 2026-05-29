// SPDX-License-Identifier: AGPL-3.0-only

/** 1e18 — matches `TimeArena` internal `WAD`. */
export const ARENA_CRED_WAD = 10n ** 18n;

/**
 * CRED burn for a CHARM-sized buy — mirrors `TimeArena._buyCred` (GitLab #268).
 * `credPerCharmWad` is onchain `TimeArena.CRED_PER_CHARM_WAD` (100e18 per 1e18 CHARM).
 */
export function credBurnForCharmWad(charmWad: bigint, credPerCharmWad: bigint): bigint {
  if (charmWad <= 0n || credPerCharmWad <= 0n) return 0n;
  return (charmWad * credPerCharmWad) / ARENA_CRED_WAD;
}

export type CredCheckoutBoundsGate =
  | { kind: "loading" }
  | { kind: "ready" }
  | {
      kind: "insufficient_cred";
      requiredCredWei: bigint;
      walletBalanceWei: bigint;
    }
  | { kind: "unavailable" };

export function resolveCredCheckoutBoundsGate(input: {
  payWith: string;
  playCredConfigured: boolean;
  requiredCredWei: bigint | undefined;
  walletBalanceWei: bigint | undefined;
}): CredCheckoutBoundsGate {
  if (input.payWith !== "cred") return { kind: "ready" };
  if (!input.playCredConfigured) return { kind: "unavailable" };
  if (input.requiredCredWei === undefined || input.walletBalanceWei === undefined) {
    return { kind: "loading" };
  }
  if (input.walletBalanceWei < input.requiredCredWei) {
    return {
      kind: "insufficient_cred",
      requiredCredWei: input.requiredCredWei,
      walletBalanceWei: input.walletBalanceWei,
    };
  }
  return { kind: "ready" };
}

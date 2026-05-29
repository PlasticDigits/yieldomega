// SPDX-License-Identifier: AGPL-3.0-only

/** 1e18 — matches `TimeArena` internal `WAD`. */
export const ARENA_CRED_WAD = 10n ** 18n;

export type ArenaCredBurnParams = {
  /** Onchain `TimeArena.CRED_BUY_BURN` (flat burn when per-CHARM rate is zero). */
  credBuyBurn: bigint;
  /** Onchain `TimeArena.CRED_PER_CHARM_WAD` when deployed (#268); `0n` = use flat burn. */
  credPerCharmWad: bigint;
};

/**
 * CRED burn for a CHARM-sized buy — mirrors `TimeArena._buyCred` (GitLab #268 / #269).
 * Prefer onchain constants over hardcoded UI math.
 */
export function credBurnForCharmWad(charmWad: bigint, params: ArenaCredBurnParams): bigint {
  if (charmWad <= 0n) return 0n;
  if (params.credPerCharmWad > 0n) {
    return (charmWad * params.credPerCharmWad) / ARENA_CRED_WAD;
  }
  return params.credBuyBurn;
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

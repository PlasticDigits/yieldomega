// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  ARENA_CRED_WAD,
  credBurnForCharmWad,
  resolveCredCheckoutBoundsGate,
} from "@/lib/arenaCredBurn";

describe("credBurnForCharmWad", () => {
  const rate = 100n * ARENA_CRED_WAD;

  it("scales burn with CHARM (TimeArena.CRED_PER_CHARM_WAD)", () => {
    expect(credBurnForCharmWad(10n ** 18n, rate)).toBe(100n * ARENA_CRED_WAD);
  });

  it("scales linearly for multi-CHARM buys", () => {
    const charm = 2n * ARENA_CRED_WAD;
    expect(credBurnForCharmWad(charm, rate)).toBe(200n * ARENA_CRED_WAD);
  });

  it("returns zero for zero CHARM or zero rate", () => {
    expect(credBurnForCharmWad(0n, rate)).toBe(0n);
    expect(credBurnForCharmWad(10n ** 18n, 0n)).toBe(0n);
  });
});

describe("resolveCredCheckoutBoundsGate", () => {
  it("passes when balance covers burn", () => {
    expect(
      resolveCredCheckoutBoundsGate({
        payWith: "cred",
        playCredConfigured: true,
        requiredCredWei: 100n,
        walletBalanceWei: 100n,
      }),
    ).toEqual({ kind: "ready" });
  });

  it("flags insufficient CRED", () => {
    expect(
      resolveCredCheckoutBoundsGate({
        payWith: "cred",
        playCredConfigured: true,
        requiredCredWei: 100n,
        walletBalanceWei: 99n,
      }),
    ).toEqual({
      kind: "insufficient_cred",
      requiredCredWei: 100n,
      walletBalanceWei: 99n,
    });
  });
});

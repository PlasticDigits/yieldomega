// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  ARENA_CRED_WAD,
  credBurnForCharmWad,
  resolveCredCheckoutBoundsGate,
} from "@/lib/arenaCredBurn";

describe("credBurnForCharmWad", () => {
  it("uses flat CRED_BUY_BURN when per-CHARM rate is zero", () => {
    expect(
      credBurnForCharmWad(10n ** 18n, { credBuyBurn: 70n * ARENA_CRED_WAD, credPerCharmWad: 0n }),
    ).toBe(70n * ARENA_CRED_WAD);
  });

  it("scales with CHARM when CRED_PER_CHARM_WAD is set (#268)", () => {
    const charm = 2n * ARENA_CRED_WAD;
    expect(
      credBurnForCharmWad(charm, {
        credBuyBurn: 70n * ARENA_CRED_WAD,
        credPerCharmWad: 100n * ARENA_CRED_WAD,
      }),
    ).toBe(200n * ARENA_CRED_WAD);
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

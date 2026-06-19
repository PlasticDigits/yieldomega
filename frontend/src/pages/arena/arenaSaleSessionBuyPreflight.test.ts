// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it, vi } from "vitest";
import { arenaSaleSessionBuyPreflight } from "./arenaSaleSessionBuyPreflight";

vi.mock("@/lib/walletBuySessionGuard", () => ({
  resolveLiveWriteConnector: () => true,
  WALLET_WRITE_NOT_READY_MESSAGE: "Wallet write connector not ready.",
}));

const TA = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" as const;
const DOUB = "0x1111111111111111111111111111111111111111" as const;
const USER = "0xdddddddddddddddddddddddddddddddddddddddd" as const;

const baseInput = {
  walletStatus: "connected",
  chainId: 31337,
  address: USER,
  timeArenaAddress: TA,
  acceptedAsset: DOUB,
  arenaPaused: false,
  payWith: "cl8y" as const,
  playCredConfigured: false,
  playCredAddress: undefined,
  credCheckoutBoundsGate: { kind: "ready" as const },
  walletCooldownRemainingSec: 0,
  charmWadSelected: 1_000_000_000_000_000_000n,
  isArenaV2: true,
  charmBoundsR: { status: "success" as const, result: [990000000000000000n, 10000000000000000000n] },
  hasLatchedCharmBounds: false,
};

describe("arenaSaleSessionBuyPreflight (GitLab #321)", () => {
  it("returns null when all sync guards pass", () => {
    expect(arenaSaleSessionBuyPreflight(baseInput)).toBeNull();
  });

  it("blocks submit when wallet buy-energy burst gap is active", () => {
    expect(
      arenaSaleSessionBuyPreflight({
        ...baseInput,
        walletCooldownRemainingSec: 42,
      }),
    ).toBe("TimeArena: burst cooldown");
  });

  it("blocks CRED pay when checkout bounds are insufficient", () => {
    expect(
      arenaSaleSessionBuyPreflight({
        ...baseInput,
        payWith: "cred",
        playCredConfigured: true,
        playCredAddress: "0x2222222222222222222222222222222222222222",
        credCheckoutBoundsGate: {
          kind: "insufficient_cred" as const,
          requiredCredWei: 1n,
          walletBalanceWei: 0n,
        },
      }),
    ).toBe("Not enough Play CRED in your wallet for this CHARM amount.");
  });

  it("blocks submit when CHARM amount is unset", () => {
    expect(
      arenaSaleSessionBuyPreflight({
        ...baseInput,
        charmWadSelected: undefined,
      }),
    ).toContain("Pick a DOUB amount");
  });
});

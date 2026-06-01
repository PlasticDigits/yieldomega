// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  deriveWarbowClaimFlagFields,
  warbowClaimFlagButtonLabel,
  warbowClaimFlagCanPress,
  warbowClaimFlagSilenceRemainingSec,
} from "./warbowClaimFlagState";

describe("warbowClaimFlagState", () => {
  it("derives holder visibility and claim eligibility from onchain reads", () => {
    const holder = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const duringSilence = deriveWarbowClaimFlagFields({
      saleActive: true,
      walletAddress: holder,
      warbowPendingFlagOwner: holder,
      warbowPendingFlagPlantAt: 1_000_000n,
      warbowFlagSilenceSec: 300n,
      phaseLedgerSecInt: 1_000_100,
    });
    expect(duringSilence.showClaimFlagControl).toBe(true);
    expect(duringSilence.canClaimWarBowFlag).toBe(false);

    const claimable = deriveWarbowClaimFlagFields({
      saleActive: true,
      walletAddress: holder,
      warbowPendingFlagOwner: holder,
      warbowPendingFlagPlantAt: 1_000_000n,
      warbowFlagSilenceSec: 300n,
      phaseLedgerSecInt: 1_000_300,
    });
    expect(claimable.canClaimWarBowFlag).toBe(true);
  });

  it("hides the control for non-holders", () => {
    const fields = deriveWarbowClaimFlagFields({
      saleActive: true,
      walletAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      warbowPendingFlagOwner: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      warbowPendingFlagPlantAt: 1_000_000n,
      warbowFlagSilenceSec: 300n,
      phaseLedgerSecInt: 1_000_400,
    });
    expect(fields.showClaimFlagControl).toBe(false);
  });

  it("formats countdown and enabled labels", () => {
    expect(
      warbowClaimFlagButtonLabel({ canClaimWarBowFlag: false, silenceRemainingSec: 200 }),
    ).toBe("Claim flag 00:03:20");
    expect(warbowClaimFlagButtonLabel({ canClaimWarBowFlag: true, silenceRemainingSec: 0 })).toBe(
      "Claim flag",
    );
  });

  it("computes silence remaining from ledger now", () => {
    expect(warbowClaimFlagSilenceRemainingSec(1_000_000, 1_000_200n)).toBe(200);
    expect(warbowClaimFlagSilenceRemainingSec(1_000_300, 1_000_200n)).toBe(0);
  });

  it("requires claim eligibility to press during silence", () => {
    expect(
      warbowClaimFlagCanPress({
        isConnected: true,
        saleActive: true,
        arenaPaused: false,
        isWriting: false,
        canClaimWarBowFlag: false,
      }),
    ).toBe(false);
    expect(
      warbowClaimFlagCanPress({
        isConnected: true,
        saleActive: true,
        arenaPaused: false,
        isWriting: false,
        canClaimWarBowFlag: true,
      }),
    ).toBe(true);
  });
});

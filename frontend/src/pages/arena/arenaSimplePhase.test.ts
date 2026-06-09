// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  derivePhase,
  formatTimerSectionTitle,
  ledgerSecIntForPhase,
  phaseBadge,
  phaseFlags,
  phaseNarrative,
  arenaHeroDisplaySecondsRemaining,
} from "./arenaSimplePhase";

const BASE = {
  hasCoreData: true,
  saleStartSec: 1000,
  deadlineSec: 2000,
  ledgerSecInt: 1500,
};

describe("arenaSimplePhase (Arena v2)", () => {
  it("counts down to saleStart in saleStartPending", () => {
    expect(
      arenaHeroDisplaySecondsRemaining({
        phase: "saleStartPending",
        saleStartSec: 1_000,
        deadlineSec: 2_000,
        chainNowSec: 900,
      }),
    ).toBe(100);
  });

  it("returns undefined when saleStart is unset in saleStartPending", () => {
    expect(
      arenaHeroDisplaySecondsRemaining({
        phase: "saleStartPending",
        saleStartSec: undefined,
        deadlineSec: 2_000,
        chainNowSec: 900,
      }),
    ).toBeUndefined();
  });

  it("counts down to deadline in saleActive", () => {
    expect(
      arenaHeroDisplaySecondsRemaining({
        phase: "saleActive",
        saleStartSec: 100,
        deadlineSec: 2_000,
        chainNowSec: 1_500,
      }),
    ).toBe(500);
  });

  it("prefers hero chain now for phase ledger", () => {
    expect(
      ledgerSecIntForPhase({ blockLedgerSecInt: 100, heroChainNowSec: 999 }),
    ).toBe(999);
  });

  it("returns 'loading' when core data missing", () => {
    expect(derivePhase({ ...BASE, hasCoreData: false })).toBe("loading");
  });

  it("returns 'loading' when saleStart is 0 (deploy-time uninitialized)", () => {
    expect(derivePhase({ ...BASE, saleStartSec: 0 })).toBe("loading");
  });

  it("returns 'saleStartPending' before saleStart", () => {
    expect(derivePhase({ ...BASE, ledgerSecInt: 999 })).toBe("saleStartPending");
  });

  it("returns 'saleActive' after saleStart (always-on arena)", () => {
    expect(derivePhase({ ...BASE, ledgerSecInt: 1000 })).toBe("saleActive");
    expect(derivePhase({ ...BASE, ledgerSecInt: 2001 })).toBe("saleActive");
    expect(derivePhase({ ...BASE, ledgerSecInt: 9999 })).toBe("saleActive");
  });

  it("phaseFlags are mutually exclusive for active phases", () => {
    expect(phaseFlags("saleActive")).toEqual({
      saleActive: true,
      saleStartPending: false,
    });
    expect(phaseFlags("saleStartPending").saleStartPending).toBe(true);
  });

  it("phaseBadge labels reflect arena UX", () => {
    expect(phaseBadge("saleStartPending").label).toBe("Pre-launch");
    expect(phaseBadge("saleActive").label).toBe("Arena live");
  });

  it("phaseNarrative mentions CHARM / DOUB for arena", () => {
    expect(phaseNarrative("saleStartPending")).toMatch(/CHARM/);
    expect(phaseNarrative("saleActive")).toMatch(/win/i);
  });

  it("formatTimerSectionTitle uses pre-open copy or Last Buy 1st-prize hook", () => {
    expect(
      formatTimerSectionTitle("saleStartPending", {
        decimals: 18,
        payoutPreview: "ready",
      }),
    ).toBe("Arena Opens In");

    expect(
      formatTimerSectionTitle("saleActive", {
        decimals: 18,
        payoutPreview: "loading",
      }),
    ).toBe("You might win … DOUB in:");

    expect(
      formatTimerSectionTitle("saleActive", {
        firstPrizeDoubWad: "4000000000000000000",
        decimals: 18,
        payoutPreview: "ready",
      }),
    ).toBe("You might win 4 DOUB in:");
  });
});

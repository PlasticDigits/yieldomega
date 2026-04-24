// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  derivePhase,
  ledgerSecIntForPhase,
  phaseBadge,
  phaseFlags,
  phaseNarrative,
  type DerivePhaseInput,
  type SaleSessionPhase,
} from "./timeCurveSimplePhase";

const BASE: DerivePhaseInput = {
  hasCoreData: true,
  ended: false,
  saleStartSec: 1000,
  deadlineSec: 2000,
  ledgerSecInt: 1500,
};

describe("ledgerSecIntForPhase (issue #48 — align phase with hero timer)", () => {
  it("prefers indexer-anchored hero time over wallet block time", () => {
    expect(
      ledgerSecIntForPhase({ blockLedgerSecInt: 100, heroChainNowSec: 5000 }),
    ).toBe(5000);
  });

  it("floors fractional hero time", () => {
    expect(
      ledgerSecIntForPhase({ blockLedgerSecInt: 100, heroChainNowSec: 5000.9 }),
    ).toBe(5000);
  });

  it("falls back to block-based time when the hero snapshot is absent", () => {
    expect(
      ledgerSecIntForPhase({ blockLedgerSecInt: 200, heroChainNowSec: undefined }),
    ).toBe(200);
  });
});

describe("derivePhase (TimeCurve simple view state machine)", () => {
  it("returns 'loading' until any core read lands", () => {
    expect(derivePhase({ ...BASE, hasCoreData: false })).toBe("loading");
  });

  it("returns 'loading' when saleStart is 0 (deploy-time uninitialized)", () => {
    expect(derivePhase({ ...BASE, saleStartSec: 0 })).toBe("loading");
  });

  it("ended=true overrides chain time (settlement view)", () => {
    expect(derivePhase({ ...BASE, ended: true, ledgerSecInt: 500 })).toBe("saleEnded");
    expect(derivePhase({ ...BASE, ended: true, ledgerSecInt: 5000 })).toBe("saleEnded");
  });

  it("returns 'saleStartPending' before saleStart", () => {
    expect(derivePhase({ ...BASE, ledgerSecInt: 999 })).toBe("saleStartPending");
  });

  it("returns 'saleActive' between saleStart and deadline", () => {
    expect(derivePhase({ ...BASE, ledgerSecInt: 1000 })).toBe("saleActive");
    expect(derivePhase({ ...BASE, ledgerSecInt: 1999 })).toBe("saleActive");
  });

  it("returns 'saleExpiredAwaitingEnd' once chain time crosses deadline (pre-endSale)", () => {
    expect(derivePhase({ ...BASE, ledgerSecInt: 2000 })).toBe("saleExpiredAwaitingEnd");
    expect(derivePhase({ ...BASE, ledgerSecInt: 9999 })).toBe("saleExpiredAwaitingEnd");
  });

  it("'saleActive' when deadlineSec is unknown but sale started", () => {
    expect(derivePhase({ ...BASE, deadlineSec: undefined })).toBe("saleActive");
  });
});

describe("phaseFlags (Arena ↔ Simple invariant — issue #40 follow-up)", () => {
  const PHASES: readonly SaleSessionPhase[] = [
    "loading",
    "saleStartPending",
    "saleActive",
    "saleExpiredAwaitingEnd",
    "saleEnded",
  ];

  it("returns at most one true flag per phase (mutually exclusive)", () => {
    for (const phase of PHASES) {
      const flags = phaseFlags(phase);
      const trueCount = Object.values(flags).filter(Boolean).length;
      expect(trueCount, `phase=${phase}`).toBeLessThanOrEqual(1);
    }
  });

  it("loading collapses every flag to false (no UX branch can render)", () => {
    expect(phaseFlags("loading")).toEqual({
      saleActive: false,
      saleEnded: false,
      saleStartPending: false,
      timerExpiredAwaitingEnd: false,
    });
  });

  it("each non-loading phase lights exactly one flag (Arena UX branches stay total)", () => {
    expect(phaseFlags("saleStartPending").saleStartPending).toBe(true);
    expect(phaseFlags("saleActive").saleActive).toBe(true);
    expect(phaseFlags("saleExpiredAwaitingEnd").timerExpiredAwaitingEnd).toBe(true);
    expect(phaseFlags("saleEnded").saleEnded).toBe(true);
  });
});

describe("phaseBadge / phaseNarrative copy contract (issue #40 A1/A2/A4)", () => {
  it("phaseBadge tones map to the dapp-wide PageBadge tones", () => {
    expect(phaseBadge("loading").tone).toBe("info");
    expect(phaseBadge("saleStartPending").tone).toBe("soon");
    expect(phaseBadge("saleActive").tone).toBe("live");
    expect(phaseBadge("saleExpiredAwaitingEnd").tone).toBe("warning");
    expect(phaseBadge("saleEnded").tone).toBe("warning");
  });

  it("phaseBadge labels do not leak protocol jargon to first-run users", () => {
    expect(phaseBadge("saleActive").label).toBe("Sale live");
    expect(phaseBadge("saleStartPending").label).toBe("Pre-launch");
    expect(phaseBadge("saleEnded").label).toBe("Sale ended");
  });

  it("phaseBadge iconSrc points at the issue #45 status pictograms (purpose folder)", () => {
    expect(phaseBadge("saleActive").iconSrc).toBe("/art/icons/status-live.png");
    expect(phaseBadge("saleEnded").iconSrc).toBe("/art/icons/status-ended.png");
    expect(phaseBadge("saleStartPending").iconSrc).toMatch(
      /^\/art\/icons\/status-prelan?ch\.png$/,
    );
    expect(phaseBadge("saleExpiredAwaitingEnd").iconSrc).toBe(
      "/art/icons/status-cooldown.png",
    );
    expect(phaseBadge("loading").iconSrc).toBe("/art/icons/status-cooldown.png");
  });

  it("narratives are short and explain CL8Y → CHARM clearly when active", () => {
    expect(phaseNarrative("saleActive")).toMatch(/timer/i);
    expect(phaseNarrative("saleActive")).toMatch(/buys?/i);
    expect(phaseNarrative("saleStartPending")).toMatch(/CHARM/);
    expect(phaseNarrative("saleEnded")).toMatch(/redeem/i);
    expect(phaseNarrative("saleExpiredAwaitingEnd")).toMatch(/End Sale/i);
  });
});

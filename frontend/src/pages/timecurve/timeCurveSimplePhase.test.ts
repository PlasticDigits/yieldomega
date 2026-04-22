// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  derivePhase,
  phaseBadge,
  phaseNarrative,
  type DerivePhaseInput,
} from "./timeCurveSimplePhase";

const BASE: DerivePhaseInput = {
  hasCoreData: true,
  ended: false,
  saleStartSec: 1000,
  deadlineSec: 2000,
  ledgerSecInt: 1500,
};

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

describe("phaseBadge / phaseNarrative copy contract (issue #40 A1/A2/A4)", () => {
  it("phaseBadge tones map to the dapp-wide PageBadge tones", () => {
    expect(phaseBadge("loading").tone).toBe("info");
    expect(phaseBadge("saleStartPending").tone).toBe("soon");
    expect(phaseBadge("saleActive").tone).toBe("live");
    expect(phaseBadge("saleExpiredAwaitingEnd").tone).toBe("warning");
    expect(phaseBadge("saleEnded").tone).toBe("warning");
  });

  it("phaseBadge labels do not leak protocol jargon to first-run users", () => {
    expect(phaseBadge("saleActive").label).toBe("Live sale");
    expect(phaseBadge("saleStartPending").label).toBe("Pre-launch");
    expect(phaseBadge("saleEnded").label).toBe("Sale ended");
  });

  it("narratives are short and explain CL8Y → CHARM clearly when active", () => {
    expect(phaseNarrative("saleActive")).toMatch(/timer/i);
    expect(phaseNarrative("saleActive")).toMatch(/buys?/i);
    expect(phaseNarrative("saleStartPending")).toMatch(/CHARM/);
    expect(phaseNarrative("saleEnded")).toMatch(/redeem/i);
    expect(phaseNarrative("saleExpiredAwaitingEnd")).toMatch(/End Sale/i);
  });
});

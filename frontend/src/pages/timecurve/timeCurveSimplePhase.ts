// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Pure helpers for the **simple TimeCurve view** (issue #40). Extracted so
 * unit tests can exercise the small state machine that drives the simple
 * view without spinning up wagmi / react-router providers.
 *
 * Invariant: `derivePhase` is the *only* source of truth for which UX
 * branch the simple page renders. The hook (`useTimeCurveSaleSession`)
 * delegates to this helper, so behavior stays identical between the live
 * page and the unit test fixtures.
 */

export type SaleSessionPhase =
  | "loading"
  | "saleStartPending"
  | "saleActive"
  | "saleExpiredAwaitingEnd"
  | "saleEnded";

export type DerivePhaseInput = {
  /** True once at least one core read completed (success or failure). */
  hasCoreData: boolean;
  /** `ended` from `TimeCurve.ended()`. */
  ended: boolean | undefined;
  /** `saleStart()` (chain time, seconds). 0 / undefined means not yet known. */
  saleStartSec: number | undefined;
  /** `deadline()` (chain time, seconds). */
  deadlineSec: number | undefined;
  /** Effective chain "now" (seconds, rounded). Falls back to wall clock when chain time is missing. */
  ledgerSecInt: number;
};

export function derivePhase(input: DerivePhaseInput): SaleSessionPhase {
  const { hasCoreData, ended, saleStartSec, deadlineSec, ledgerSecInt } = input;
  if (!hasCoreData) return "loading";
  if (ended === true) return "saleEnded";
  if (saleStartSec === undefined || saleStartSec === 0) return "loading";
  if (ledgerSecInt < saleStartSec) return "saleStartPending";
  if (deadlineSec !== undefined && ledgerSecInt >= deadlineSec) {
    return "saleExpiredAwaitingEnd";
  }
  return "saleActive";
}

export type PhaseBadge = {
  label: string;
  /** Badge tone matches the dapp-wide `PageBadgeTone` palette. */
  tone: "live" | "soon" | "warning" | "info";
};

const BADGE: Record<SaleSessionPhase, PhaseBadge> = {
  loading: { label: "Loading", tone: "info" },
  saleStartPending: { label: "Pre-launch", tone: "soon" },
  saleActive: { label: "Live sale", tone: "live" },
  saleExpiredAwaitingEnd: { label: "Timer expired", tone: "warning" },
  saleEnded: { label: "Sale ended", tone: "warning" },
};

export function phaseBadge(phase: SaleSessionPhase): PhaseBadge {
  return BADGE[phase];
}

/**
 * One-sentence narrative shown directly under the hero countdown so a new
 * visitor immediately understands what they are looking at (issue #40 A1/A2).
 */
export function phaseNarrative(phase: SaleSessionPhase): string {
  switch (phase) {
    case "saleStartPending":
      return "When this hits zero, the sale opens and you can buy CHARM with CL8Y.";
    case "saleActive":
      return "When this hits zero, the sale ends and buys stop. Each buy can extend the timer.";
    case "saleExpiredAwaitingEnd":
      return "Timer expired. Anyone can call End Sale to settle the round.";
    case "saleEnded":
      return "Sale is over. Holders of CHARM can redeem for DOUB.";
    default:
      return "Loading sale state…";
  }
}

/**
 * Mutually-exclusive boolean view of `SaleSessionPhase`.
 *
 * Used by the **Arena** view (`TimeCurvePage.tsx`) so the legacy boolean-driven
 * UX branches (`saleActive` / `saleEnded` / `saleStartPending` /
 * `timerExpiredAwaitingEnd`) stay derived from the same state machine as the
 * Simple view. **Invariant:** at most one of these four flags is `true`; if
 * the phase is `loading`, all four are `false` (the page should render its
 * loading state instead).
 */
export type PhaseFlags = {
  saleActive: boolean;
  saleEnded: boolean;
  saleStartPending: boolean;
  timerExpiredAwaitingEnd: boolean;
};

export function phaseFlags(phase: SaleSessionPhase): PhaseFlags {
  return {
    saleActive: phase === "saleActive",
    saleEnded: phase === "saleEnded",
    saleStartPending: phase === "saleStartPending",
    timerExpiredAwaitingEnd: phase === "saleExpiredAwaitingEnd",
  };
}

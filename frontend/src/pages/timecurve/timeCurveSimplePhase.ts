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

/**
 * Picks the chain "now" for {@link derivePhase} and pre-start windows.
 * Prefer the TimeCurve **hero timer** (indexer-anchored + wall skew) so phase
 * matches the deadline countdown. `wagmi` `latestBlock` can lag a different
 * JSON-RPC (local Anvil, multi-agent stacks) and falsely report
 * pre-start while the sale is live (issue #48).
 */
export function ledgerSecIntForPhase(input: {
  /** From `useBlock` / `block.timestamp` (or fallbacks) — same as today when no hero snapshot. */
  blockLedgerSecInt: number;
  /** `chainNowSec` from `useTimecurveHeroTimer` when the indexer has delivered a timer snapshot. */
  heroChainNowSec: number | undefined;
}): number {
  return input.heroChainNowSec !== undefined
    ? Math.floor(input.heroChainNowSec)
    : input.blockLedgerSecInt;
}

export function derivePhase(input: DerivePhaseInput): SaleSessionPhase {
  const { hasCoreData, ended, saleStartSec, deadlineSec, ledgerSecInt } = input;
  if (!hasCoreData) return "loading";
  if (ended === true) return "saleEnded";
  if (saleStartSec === undefined || saleStartSec === 0) return "loading";
  if (ledgerSecInt < saleStartSec) return "saleStartPending";
  if (deadlineSec !== undefined && ledgerSecInt > deadlineSec) {
    return "saleExpiredAwaitingEnd";
  }
  return "saleActive";
}

export type TimecurveHeroCountdownInput = {
  phase: SaleSessionPhase;
  /** Prefer `heroTimer.saleStartSec` from indexer chain-timer when > 0; else RPC `saleStart`. */
  saleStartSec: number | undefined;
  /** Prefer indexer snapshot `deadline_sec`; falls back to RPC when snapshot missing. */
  deadlineSec: number | undefined;
  /** `useTimecurveHeroTimer` `chainNowSec` (indexer-anchored when snapshot exists). */
  chainNowSec: number | undefined;
};

/**
 * Single UX countdown for TimeCurve hero surfaces: **opens in** (`saleStartPending`) vs **round timer**
 * (`saleActive` / `saleExpiredAwaitingEnd`). Uses the same phase machine as {@link derivePhase}
 * ([issue #115](https://gitlab.com/PlasticDigits/yieldomega/-/issues/115)).
 */
export function timecurveHeroDisplaySecondsRemaining(
  input: TimecurveHeroCountdownInput,
): number | undefined {
  const { phase, saleStartSec, deadlineSec, chainNowSec } = input;
  if (chainNowSec === undefined || !Number.isFinite(chainNowSec)) {
    return undefined;
  }
  const floorNow = Math.floor(chainNowSec);
  if (phase === "saleStartPending") {
    if (
      saleStartSec === undefined ||
      !Number.isFinite(saleStartSec) ||
      saleStartSec <= 0
    ) {
      return undefined;
    }
    return Math.max(0, saleStartSec - floorNow);
  }
  if (phase === "saleActive" || phase === "saleExpiredAwaitingEnd") {
    if (deadlineSec === undefined || !Number.isFinite(deadlineSec)) {
      return undefined;
    }
    return Math.max(0, deadlineSec - floorNow);
  }
  return undefined;
}

export type PhaseBadge = {
  label: string;
  /** Badge tone matches the dapp-wide `PageBadgeTone` palette. */
  tone: "live" | "soon" | "warning" | "info";
  /**
   * Pictogram path under [`frontend/public/art/icons/`](../../../public/art/icons/)
   * (issue #45 + #57). Decorative; the textual `label` remains the source of truth
   * for assistive tech. Pre-launch uses the corrected `status-prelaunch.png`
   * filename ([issue #57](https://gitlab.com/PlasticDigits/yieldomega/-/issues/57));
   * `status-prelanch.png` remains in-tree as a duplicate of the same raster for
   * historic manifests.
   */
  iconSrc: string;
};

const BADGE: Record<SaleSessionPhase, PhaseBadge> = {
  loading: { label: "Loading", tone: "info", iconSrc: "/art/icons/status-cooldown.png" },
  saleStartPending: {
    label: "Pre-launch",
    tone: "soon",
    iconSrc: "/art/icons/status-prelaunch.png",
  },
  saleActive: { label: "Sale live", tone: "live", iconSrc: "/art/icons/status-live.png" },
  saleExpiredAwaitingEnd: {
    label: "Timer expired",
    tone: "warning",
    iconSrc: "/art/icons/status-cooldown.png",
  },
  saleEnded: { label: "Sale ended", tone: "warning", iconSrc: "/art/icons/status-ended.png" },
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
 *
 * **Round deadline (GitLab #136):** onchain **`buy`** / WarBow mutations allow
 * **`block.timestamp <= deadline()`**; `derivePhase` keeps **`saleActive`** until
 * **`ledgerSecInt > deadlineSec`** (exclusive end), matching **`endSale`**’s **`>` deadline**.
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

// SPDX-License-Identifier: AGPL-3.0-only

import { formatCompactFromRaw } from "@/lib/compactNumberFormat";

/**
 * Pure helpers for the **simple TimeCurve view** (issue #40). Extracted so
 * unit tests can exercise the small state machine that drives the simple
 * view without spinning up wagmi / react-router providers.
 *
 * Arena v2 (#256): always-on round — no sale-end / redemption phases.
 */

export type SaleSessionPhase = "loading" | "saleStartPending" | "saleActive";

export type DerivePhaseInput = {
  /** True once at least one core read completed (success or failure). */
  hasCoreData: boolean;
  /** `arenaStart()` (chain time, seconds). 0 / undefined means not yet known. */
  saleStartSec: number | undefined;
  /** `deadline()` (chain time, seconds). */
  deadlineSec: number | undefined;
  /** Effective chain "now" (seconds, rounded). Falls back to wall clock when chain time is missing. */
  ledgerSecInt: number;
};

/**
 * Picks the chain "now" for {@link derivePhase} and pre-start windows.
 * Prefer the TimeCurve **hero timer** (indexer-anchored + wall skew) so phase
 * matches the deadline countdown.
 */
export function ledgerSecIntForPhase(input: {
  blockLedgerSecInt: number;
  heroChainNowSec: number | undefined;
}): number {
  return input.heroChainNowSec !== undefined
    ? Math.floor(input.heroChainNowSec)
    : input.blockLedgerSecInt;
}

export function derivePhase(input: DerivePhaseInput): SaleSessionPhase {
  const { hasCoreData, saleStartSec, ledgerSecInt } = input;
  if (!hasCoreData) return "loading";
  if (saleStartSec === undefined || saleStartSec === 0) return "loading";
  if (ledgerSecInt < saleStartSec) return "saleStartPending";
  return "saleActive";
}

export type ArenaHeroCountdownInput = {
  phase: SaleSessionPhase;
  /** Prefer `heroTimer.saleStartSec` from indexer chain-timer when > 0; else RPC `arenaStart`. */
  saleStartSec: number | undefined;
  /** Prefer indexer snapshot `deadline_sec`; falls back to RPC when snapshot missing. */
  deadlineSec: number | undefined;
  /** `useArenaHeroTimer` `chainNowSec` (indexer-anchored when snapshot exists). */
  chainNowSec: number | undefined;
};

/**
 * Single UX countdown for TimeCurve hero surfaces: **opens in** (`saleStartPending`) vs **round timer**
 * (`saleActive`).
 */
export function arenaHeroDisplaySecondsRemaining(
  input: ArenaHeroCountdownInput,
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
  if (phase === "saleActive") {
    if (deadlineSec === undefined || !Number.isFinite(deadlineSec)) {
      return undefined;
    }
    return Math.max(0, deadlineSec - floorNow);
  }
  return undefined;
}

export type PhaseBadge = {
  label: string;
  tone: "live" | "soon" | "warning" | "info";
  iconSrc: string;
};

const BADGE: Record<SaleSessionPhase, PhaseBadge> = {
  loading: { label: "Loading", tone: "info", iconSrc: "/art/icons/status-cooldown.png" },
  saleStartPending: {
    label: "Pre-launch",
    tone: "soon",
    iconSrc: "/art/icons/status-prelaunch.png",
  },
  saleActive: { label: "Arena live", tone: "live", iconSrc: "/art/icons/status-live.png" },
};

export function phaseBadge(phase: SaleSessionPhase): PhaseBadge {
  return BADGE[phase];
}

export function phaseNarrative(phase: SaleSessionPhase): string {
  switch (phase) {
    case "saleStartPending":
      return "When this hits zero, the arena opens and you can buy CHARM with DOUB.";
    case "saleActive":
      return "You might win in:";
    default:
      return "Loading arena state…";
  }
}

export type TimerPayoutPreviewState = "loading" | "unavailable" | "ready";

/** Primary timer bay `<h2>` — pre-open label or Last Buy 1st-prize hook. */
export function formatTimerSectionTitle(
  phase: SaleSessionPhase,
  opts: {
    firstPrizeDoubWad?: string;
    decimals: number;
    payoutPreview: TimerPayoutPreviewState;
  },
): string {
  if (phase === "saleStartPending") {
    return "Arena Opens In";
  }

  const prizeSegment = (() => {
    if (opts.payoutPreview === "loading" || opts.firstPrizeDoubWad === undefined) {
      return "…";
    }
    if (opts.payoutPreview === "unavailable") {
      return "—";
    }
    return formatCompactFromRaw(opts.firstPrizeDoubWad, opts.decimals, { sigfigs: 3 });
  })();

  return `You might win ${prizeSegment} DOUB in:`;
}

export type PhaseFlags = {
  saleActive: boolean;
  saleStartPending: boolean;
};

export function phaseFlags(phase: SaleSessionPhase): PhaseFlags {
  return {
    saleActive: phase === "saleActive",
    saleStartPending: phase === "saleStartPending",
  };
}

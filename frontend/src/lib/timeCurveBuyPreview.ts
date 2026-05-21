// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import type { BuyItem } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";

/** Onchain defaults from `TimeCurve.sol` / `TimeMath` — override via chain reads when passed. */
export type TimeCurveBuyPreviewPolicy = {
  timerExtensionSec: number;
  timerCapSec: number;
  resetBelowRemainingSec: number;
  resetToRemainingSec: number;
  defendedStreakWindowSec: number;
  warbowBaseBuyBp: number;
  warbowTimerResetBonusBp: number;
  warbowClutchBonusBp: number;
  warbowStreakBreakMultBp: number;
  warbowAmbushBonusBp: number;
};

export const DEFAULT_TIMECURVE_BUY_PREVIEW_POLICY: TimeCurveBuyPreviewPolicy = {
  timerExtensionSec: 120,
  timerCapSec: 96 * 3600,
  resetBelowRemainingSec: 780,
  resetToRemainingSec: 900,
  defendedStreakWindowSec: 900,
  warbowBaseBuyBp: 250,
  warbowTimerResetBonusBp: 500,
  warbowClutchBonusBp: 150,
  warbowStreakBreakMultBp: 100,
  warbowAmbushBonusBp: 200,
};

export type PreviewBuyTimerResult = {
  secondsAdded: number;
  hardReset: boolean;
};

/**
 * Mirrors `TimeMath.extendDeadlineOrResetBelowThreshold` for a hypothetical buy at
 * `secondsRemaining` before the tx (deadline = now + remaining).
 */
export function previewBuyTimerSecondsAdded(
  secondsRemaining: number,
  policy: TimeCurveBuyPreviewPolicy,
): PreviewBuyTimerResult {
  const remaining = Math.max(0, secondsRemaining);
  const {
    timerExtensionSec,
    timerCapSec,
    resetBelowRemainingSec,
    resetToRemainingSec,
  } = policy;

  if (remaining < resetBelowRemainingSec) {
    const targetRemaining = Math.min(resetToRemainingSec, timerCapSec);
    const secondsAdded = Math.max(0, targetRemaining - remaining);
    return { secondsAdded, hardReset: true };
  }

  const secondsAdded = Math.max(0, Math.min(timerExtensionSec, timerCapSec - remaining));
  return { secondsAdded, hardReset: false };
}

export type PreviewWarbowBpPill = {
  amount: number;
  label: string;
};

export type PreviewDefendedStreakPill =
  | { kind: "continue"; nextStreak: number }
  | { kind: "break"; priorStreak: number; bpAmount: number }
  | { kind: "start" };

export type PreviewWarbowBuyEffects = {
  timer: PreviewBuyTimerResult | undefined;
  bpPills: PreviewWarbowBpPill[];
  streak: PreviewDefendedStreakPill | undefined;
};

function parseBuyBigIntField(v: string | undefined): bigint | undefined {
  if (v === undefined || v === null) {
    return undefined;
  }
  try {
    return BigInt(v.trim() || "0");
  } catch {
    return undefined;
  }
}

/**
 * Infer `_dsLastUnderWindowBuyer` from indexer buys while the sale is in the defended-streak window.
 * Uses the newest buy with `actual_seconds_added > 0`. May be stale vs chain — see GitLab #227.
 */
export function inferDefendedStreakHolderFromRecentBuys(
  recentBuys: readonly BuyItem[] | null | undefined,
): { holder: HexAddress; holderActiveStreak: bigint } | undefined {
  if (!recentBuys?.length) {
    return undefined;
  }
  for (const b of recentBuys) {
    const added = parseBuyBigIntField(b.actual_seconds_added) ?? 0n;
    if (added <= 0n) {
      continue;
    }
    const streak = parseBuyBigIntField(b.buyer_active_defended_streak) ?? 0n;
    return { holder: b.buyer as HexAddress, holderActiveStreak: streak };
  }
  return undefined;
}

export function previewWarbowBuyEffects(args: {
  secondsRemaining: number | undefined;
  policy?: TimeCurveBuyPreviewPolicy;
  walletAddress?: HexAddress;
  activeDefendedStreak?: bigint;
  recentBuys?: readonly BuyItem[] | null;
}): PreviewWarbowBuyEffects {
  const policy = args.policy ?? DEFAULT_TIMECURVE_BUY_PREVIEW_POLICY;
  const remaining = args.secondsRemaining;

  if (remaining === undefined) {
    return { timer: undefined, bpPills: [], streak: undefined };
  }

  const timer = previewBuyTimerSecondsAdded(remaining, policy);
  const hardReset = timer.hardReset;

  const bpPills: PreviewWarbowBpPill[] = [];
  bpPills.push({ amount: policy.warbowBaseBuyBp, label: "Base" });
  if (hardReset) {
    bpPills.push({ amount: policy.warbowTimerResetBonusBp, label: "Reset" });
  }
  if (remaining < 30) {
    bpPills.push({ amount: policy.warbowClutchBonusBp, label: "Clutch" });
  }

  let streak: PreviewDefendedStreakPill | undefined;
  let bpStreakBreak = 0;
  let bpAmbush = 0;

  if (remaining < policy.defendedStreakWindowSec) {
    const holderInfo = inferDefendedStreakHolderFromRecentBuys(args.recentBuys);
    const wallet = args.walletAddress?.toLowerCase();
    const holderAddr = holderInfo?.holder.toLowerCase();
    const holderStreakOnChain =
      holderAddr && wallet && holderAddr === wallet
        ? args.activeDefendedStreak
        : holderInfo?.holderActiveStreak;

    if (holderInfo && holderAddr && wallet && holderAddr === wallet) {
      const cur = args.activeDefendedStreak ?? 0n;
      if (cur > 0n) {
        streak = { kind: "continue", nextStreak: Number(cur) + 1 };
      } else {
        streak = { kind: "start" };
      }
    } else if (holderInfo && (holderStreakOnChain ?? 0n) > 0n) {
      const prior = Number(holderStreakOnChain);
      bpStreakBreak = prior * policy.warbowStreakBreakMultBp;
      bpPills.push({ amount: bpStreakBreak, label: "Streak break" });
      if (hardReset) {
        bpAmbush = policy.warbowAmbushBonusBp;
        bpPills.push({ amount: bpAmbush, label: "Ambush" });
      }
      streak = { kind: "break", priorStreak: prior, bpAmount: bpStreakBreak };
    } else {
      streak = { kind: "start" };
    }
  }

  return { timer, bpPills, streak };
}

export function formatPreviewTimerPill(secondsAdded: number): string | undefined {
  if (secondsAdded <= 0) {
    return undefined;
  }
  return `+${formatLocaleInteger(secondsAdded)}s`;
}

export function formatPreviewBpPill(pill: PreviewWarbowBpPill): string {
  return `+${formatLocaleInteger(pill.amount)} BP ${pill.label}`;
}

export function formatPreviewStreakPill(streak: PreviewDefendedStreakPill): string {
  switch (streak.kind) {
    case "continue":
      return `+1 streak (${formatLocaleInteger(streak.nextStreak)})`;
    case "break":
      return "Break streak";
    case "start":
      return "Start streak";
  }
}

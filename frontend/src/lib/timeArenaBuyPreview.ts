// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import type { BuyItem } from "@/lib/indexerApi";
import { formatLocaleInteger } from "@/lib/formatAmount";

/** Onchain defaults from `TimeArena.sol` / `TimeMath` — override via chain reads when passed. */
export type ArenaBuyPreviewPolicy = {
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

export const DEFAULT_ARENA_BUY_PREVIEW_POLICY: ArenaBuyPreviewPolicy = {
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
  policy: ArenaBuyPreviewPolicy,
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
  | { kind: "end_other"; priorStreak?: number; bpAmount?: number }
  | { kind: "end_own" }
  | { kind: "start" };

/** Pre-buy checkout copy when a buy clears the viewer's defended streak above the window. */
export const STREAK_PILL_END_OWN = "Warning: Ends Your Streak";

/** Pre-buy / post-buy copy when a buy ends another wallet's defended streak. */
export const STREAK_PILL_END_OTHER = "End Streak";

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

/** Pre-buy Last Buy seconds remaining from indexed `new_deadline` − `actual_seconds_added` − block time. */
export function secondsRemainingBeforeBuyFromRow(buy: BuyItem): number | undefined {
  const newDeadline = parseBuyBigIntField(buy.new_deadline);
  const actualAdded = parseBuyBigIntField(buy.actual_seconds_added) ?? 0n;
  const blockTs = parseBuyBigIntField(buy.block_timestamp ?? undefined);
  if (newDeadline === undefined || blockTs === undefined) {
    return undefined;
  }
  const remaining = newDeadline - actualAdded - blockTs;
  if (remaining < 0n) {
    return 0;
  }
  if (remaining > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(remaining);
}

/**
 * Infer `_dsLastUnderWindowBuyer` from indexer buys, mirroring `TimeArena._processDefendedStreak`:
 * newest-first, an over-window buy clears the holder; an under-window timer-moving buy takes it.
 * `holderActiveStreak` is the indexed post-buy streak (#366); `undefined` on pre-backfill rows.
 * May be stale vs chain — see GitLab #227.
 */
export function inferDefendedStreakHolderFromRecentBuys(
  recentBuys: readonly BuyItem[] | null | undefined,
  windowSec = DEFAULT_ARENA_BUY_PREVIEW_POLICY.defendedStreakWindowSec,
): { holder: HexAddress; holderActiveStreak: bigint | undefined } | undefined {
  if (!recentBuys?.length) {
    return undefined;
  }
  for (const b of recentBuys) {
    const remainingBefore = secondsRemainingBeforeBuyFromRow(b);
    if (remainingBefore !== undefined && remainingBefore >= windowSec) {
      // Onchain: buys at/above the window clear the holder regardless of seconds added.
      return undefined;
    }
    const added = parseBuyBigIntField(b.actual_seconds_added) ?? 0n;
    if (added <= 0n) {
      continue;
    }
    const streak = parseBuyBigIntField(b.buyer_active_defended_streak);
    if (streak !== undefined && streak <= 0n) {
      // Under-window buy with post-buy streak 0: progression-gated buyer (#299) — holder unchanged.
      continue;
    }
    return { holder: b.buyer as HexAddress, holderActiveStreak: streak };
  }
  return undefined;
}

/** Only valid when the viewer is the inferred holder: an inferred holder always has streak ≥ 1. */
function resolveWalletDefendedStreak(
  activeDefendedStreak: bigint | undefined,
  holderInfo: { holderActiveStreak: bigint | undefined } | undefined,
): bigint {
  const chain = activeDefendedStreak ?? 0n;
  const indexed = holderInfo?.holderActiveStreak ?? 0n;
  const best = chain > indexed ? chain : indexed;
  return best > 0n ? best : 1n;
}

export function previewWarbowBuyEffects(args: {
  secondsRemaining: number | undefined;
  policy?: ArenaBuyPreviewPolicy;
  walletAddress?: HexAddress;
  activeDefendedStreak?: bigint;
  recentBuys?: readonly BuyItem[] | null;
}): PreviewWarbowBuyEffects {
  const policy = args.policy ?? DEFAULT_ARENA_BUY_PREVIEW_POLICY;
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

  const holderInfo = inferDefendedStreakHolderFromRecentBuys(
    args.recentBuys,
    policy.defendedStreakWindowSec,
  );
  const wallet = args.walletAddress?.toLowerCase();
  const holderAddr = holderInfo?.holder.toLowerCase();
  const walletIsHolder = Boolean(holderInfo && holderAddr && wallet && holderAddr === wallet);
  const holderStreak = holderInfo
    ? walletIsHolder
      ? resolveWalletDefendedStreak(args.activeDefendedStreak, holderInfo)
      : holderInfo.holderActiveStreak ?? 1n
    : 0n;

  if (remaining >= policy.defendedStreakWindowSec) {
    if (holderStreak > 0n && wallet) {
      streak = walletIsHolder ? { kind: "end_own" } : { kind: "end_other" };
    }
  } else if (remaining < policy.defendedStreakWindowSec) {
    if (walletIsHolder) {
      const cur = resolveWalletDefendedStreak(args.activeDefendedStreak, holderInfo);
      streak = { kind: "continue", nextStreak: Number(cur) + 1 };
    } else if (holderInfo && holderStreak > 0n) {
      const prior = Number(holderStreak);
      bpStreakBreak = prior * policy.warbowStreakBreakMultBp;
      bpPills.push({ amount: bpStreakBreak, label: "Streak break" });
      if (hardReset) {
        bpAmbush = policy.warbowAmbushBonusBp;
        bpPills.push({ amount: bpAmbush, label: "Ambush" });
      }
      streak = { kind: "end_other", priorStreak: prior, bpAmount: bpStreakBreak };
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
    case "end_other":
      return STREAK_PILL_END_OTHER;
    case "end_own":
      return STREAK_PILL_END_OWN;
    case "start":
      return "Start streak";
  }
}

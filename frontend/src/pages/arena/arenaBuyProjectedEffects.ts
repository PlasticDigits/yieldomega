// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import { shortAddress } from "@/lib/addressFormat";
import { clampPlayerLevel, isFeatureUnlocked, MAX_PLAYER_LEVEL } from "@/lib/arenaProgression";
import { applyXpGain, xpForCharm } from "@/lib/arenaXpMath";
import { formatLocaleInteger } from "@/lib/formatAmount";
import type { BuyItem } from "@/lib/indexerApi";
import {
  type ArenaBuyPreviewPolicy,
  formatPreviewBpPill,
  formatPreviewStreakPill,
  formatPreviewTimerPill,
  previewWarbowBuyEffects,
} from "@/lib/timeArenaBuyPreview";
import { buildBuyBattlePointBreakdown } from "@/lib/timeArenaUx";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** XP preview from cleared CHARM weight (mirrors onchain `ArenaXp.xpForCharm`). */
export function formatBuyProjectedXpLine(charmWad: bigint): string {
  return `+${formatLocaleInteger(xpForCharm(charmWad).toString())}xp`;
}

/** Level transition chip when a buy crosses an XP threshold (e.g. `1->2 Level (+1 max move)`). */
export function formatBuyProjectedLevelLine(levelBefore: number, levelAfter: number): string | undefined {
  const before = clampPlayerLevel(levelBefore);
  const after = clampPlayerLevel(levelAfter);
  if (after <= before) return undefined;
  const extraMoves = after - before;
  const moveLabel = extraMoves === 1 ? "move" : "moves";
  return `${before}->${after} Level (+${extraMoves} max ${moveLabel})`;
}

/** Post-buy level after applying charm XP to cached `level` + `xpTowardNext` (#265 / #299). */
export function previewBuyPlayerLevelAfterCharm(
  playerLevel: bigint | number,
  xpTowardNext: bigint | number | undefined,
  charmWeightWad: bigint | undefined,
): { levelBefore: number; levelAfter: number } {
  const levelBefore = clampPlayerLevel(playerLevel);
  if (charmWeightWad === undefined || charmWeightWad <= 0n) {
    return { levelBefore, levelAfter: levelBefore };
  }
  const toward = BigInt(xpTowardNext ?? 0);
  const { level } = applyXpGain(BigInt(levelBefore), toward, xpForCharm(charmWeightWad));
  return { levelBefore, levelAfter: clampPlayerLevel(Number(level)) };
}

export type BuildArenaBuyProjectedEffectLinesArgs = {
  charmWadSelected?: bigint;
  /**
   * When set, used for the "+Xxp" chip instead of {@link charmWadSelected}
   * (e.g. cleared `charmWad` plus referral / presale CHARM-weight bonuses).
   */
  charmWeightTotalWad?: bigint;
  secondsRemaining?: number;
  /** @deprecated Timer preview uses {@link previewPolicy} + {@link secondsRemaining}; kept for latch compat. */
  timerExtensionPreview?: number;
  activeDefendedStreak?: bigint;
  plantWarBowFlag: boolean;
  flagOwnerAddr?: HexAddress;
  /** Pending flag plant time (seconds); treat missing as unset (no pending flag). */
  flagPlantAtSec?: bigint;
  walletAddress?: HexAddress;
  /** Indexer head for defended-streak holder inference (GitLab #227). */
  recentBuys?: readonly BuyItem[] | null;
  previewPolicy?: ArenaBuyPreviewPolicy;
  /** Effective onchain player level for progression-gated preview lines (#299). */
  playerLevel?: bigint | number;
  /** Cached progress toward next level; used for level-up chip + post-buy feature gates (#265). */
  xpTowardNext?: bigint | number;
  /** Last Buy timer armed (`podium_timer_armed[0]`); false when first buy starts the epoch timer (#330). */
  lastBuyTimerArmed?: boolean;
  /** `formatWallet(addr, "rival")` on Arena; Simple may use {@link shortAddress}. */
  formatRivalWallet: (addr: HexAddress) => string;
};

/**
 * Narrative chips for the buy checkout “projected effects” rail — shared by
 * Time Arena Simple and Arena so the copy stays aligned with the live sizing
 * reads (issue #82 / #191 / #227).
 *
 * Timer/scoring pills mirror **Last Buy (cat 0)** only ([#271](https://gitlab.com/PlasticDigits/yieldomega/-/issues/271)).
 * Secondary podium extensions and scoring lines follow player level ([#299](https://gitlab.com/PlasticDigits/yieldomega/-/issues/299)).
 */
/** Buy preview chip when the first qualifying buy will arm Last Buy (#330). */
export const BUY_PREVIEW_START_TIMER = "START TIMER";

export function buildArenaBuyProjectedEffectLines(
  args: BuildArenaBuyProjectedEffectLinesArgs,
): string[] {
  const {
    charmWadSelected,
    charmWeightTotalWad,
    secondsRemaining,
    activeDefendedStreak,
    plantWarBowFlag,
    flagOwnerAddr,
    flagPlantAtSec,
    walletAddress,
    recentBuys,
    previewPolicy,
    playerLevel = MAX_PLAYER_LEVEL,
    xpTowardNext,
    lastBuyTimerArmed,
    formatRivalWallet,
  } = args;

  const items: string[] = [];

  const charmLineWad = charmWeightTotalWad ?? charmWadSelected;
  const { levelBefore, levelAfter } = previewBuyPlayerLevelAfterCharm(
    playerLevel,
    xpTowardNext,
    charmLineWad,
  );
  const levelNum = levelAfter;

  if (charmLineWad !== undefined && charmLineWad > 0n) {
    items.push(formatBuyProjectedXpLine(charmLineWad));
    const levelLine = formatBuyProjectedLevelLine(levelBefore, levelAfter);
    if (levelLine) {
      items.push(levelLine);
    }
  }

  if (secondsRemaining === undefined) {
    items.push(lastBuyTimerArmed === false ? BUY_PREVIEW_START_TIMER : "Timer pending");
  } else {
    const fx = previewWarbowBuyEffects({
      secondsRemaining,
      policy: previewPolicy,
      walletAddress,
      activeDefendedStreak,
      recentBuys,
    });
    const timerPill = fx.timer ? formatPreviewTimerPill(fx.timer.secondsAdded) : undefined;
    if (timerPill) {
      items.push(timerPill);
    } else if (secondsRemaining > 300) {
      items.push("Timer capped");
    }
    if (fx.streak && isFeatureUnlocked(levelNum, "defended_streak")) {
      items.push(formatPreviewStreakPill(fx.streak));
    }
    if (isFeatureUnlocked(levelNum, "warbow")) {
      for (const bp of fx.bpPills) {
        items.push(formatPreviewBpPill(bp));
      }
    }
  }

  if (plantWarBowFlag && isFeatureUnlocked(levelNum, "warbow_flag")) {
    const plantAt = flagPlantAtSec ?? 0n;
    const hasPendingFlag =
      flagOwnerAddr !== undefined &&
      flagOwnerAddr.toLowerCase() !== ZERO_ADDR &&
      plantAt > 0n;
    const iHoldPlantFlag = Boolean(
      walletAddress &&
        flagOwnerAddr &&
        walletAddress.toLowerCase() === flagOwnerAddr.toLowerCase(),
    );
    if (hasPendingFlag && iHoldPlantFlag) {
      items.push("Refresh flag");
    } else if (hasPendingFlag && flagOwnerAddr !== undefined) {
      items.push(`Replace flag ${formatRivalWallet(flagOwnerAddr)}`);
    } else {
      items.push("Plant flag");
    }
  }

  items.push("Last Buyer");

  return items;
}

const INDEXED_BP_PILL_LABEL: Record<string, string> = {
  base: "Base",
  reset: "Reset",
  clutch: "Clutch",
  streak: "Streak break",
  ambush: "Ambush",
  penalty: "Flag penalty",
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

/** Pre-buy seconds remaining inferred from indexed deadline + block time. */
export function inferSecondsRemainingBeforeBuy(buy: BuyItem): number | undefined {
  const newDeadline = parseBuyBigIntField(buy.new_deadline);
  const actualAdded = parseBuyBigIntField(buy.actual_seconds_added) ?? 0n;
  const blockTs = parseBuyBigIntField(buy.block_timestamp ?? undefined);
  if (newDeadline === undefined || blockTs === undefined) {
    return undefined;
  }
  const deadlineBefore = newDeadline - actualAdded;
  const remaining = deadlineBefore - blockTs;
  if (remaining < 0n) {
    return 0;
  }
  if (remaining > BigInt(Number.MAX_SAFE_INTEGER)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return Number(remaining);
}

/** Buys strictly before `target` in chain order (for streak / WarBow inference). */
export function buysBeforeTarget(
  recentBuys: readonly BuyItem[] | null | undefined,
  target: BuyItem,
): BuyItem[] | undefined {
  if (!recentBuys?.length) {
    return undefined;
  }
  const blockN = Number(target.block_number);
  return recentBuys.filter((b) => {
    const bn = Number(b.block_number);
    if (bn < blockN) {
      return true;
    }
    if (bn > blockN) {
      return false;
    }
    return b.log_index < target.log_index;
  });
}

export type BuildArenaBuyActualEffectLinesArgs = {
  recentBuys?: readonly BuyItem[] | null;
  previewPolicy?: ArenaBuyPreviewPolicy;
  playerLevel?: bigint | number;
  formatRivalWallet?: (addr: HexAddress) => string;
};

/**
 * Narrative chips for a completed buy — mirrors the buy checkout preview rail but
 * uses indexed `charm_wad` / `actual_seconds_added` where available ([#282](https://gitlab.com/PlasticDigits/yieldomega/-/issues/282)).
 * WarBow / streak pills reconstruct from pre-buy timer when extended buy-row fields are absent.
 */
export function buildArenaBuyActualEffectLines(
  buy: BuyItem,
  args: BuildArenaBuyActualEffectLinesArgs = {},
): string[] {
  const {
    recentBuys,
    previewPolicy,
    playerLevel = MAX_PLAYER_LEVEL,
    formatRivalWallet: _formatRivalWallet = shortAddress,
  } = args;

  const levelNum =
    typeof playerLevel === "bigint" ? Number(playerLevel) : playerLevel ?? MAX_PLAYER_LEVEL;

  const items: string[] = [];

  const charmWad = parseBuyBigIntField(buy.charm_wad);
  if (charmWad !== undefined && charmWad > 0n) {
    items.push(formatBuyProjectedXpLine(charmWad));
  }

  const actualSecs = Number(parseBuyBigIntField(buy.actual_seconds_added) ?? 0n);
  const timerPill = formatPreviewTimerPill(actualSecs);
  if (timerPill) {
    items.push(timerPill);
  }

  const indexedBp = buildBuyBattlePointBreakdown(buy);
  const remainingBefore = inferSecondsRemainingBeforeBuy(buy);
  const priorBuys = buysBeforeTarget(recentBuys, buy);

  if (indexedBp.length > 0 && isFeatureUnlocked(levelNum, "warbow")) {
    for (const row of indexedBp) {
      items.push(
        formatPreviewBpPill({
          amount: Number(row.value),
          label: INDEXED_BP_PILL_LABEL[row.key] ?? row.label,
        }),
      );
    }
  } else if (remainingBefore !== undefined) {
    let preBuyStreak: bigint | undefined;
    const postStreak = parseBuyBigIntField(buy.buyer_active_defended_streak);
    if (postStreak !== undefined) {
      preBuyStreak = postStreak > 0n ? postStreak - 1n : 0n;
    }

    const fx = previewWarbowBuyEffects({
      secondsRemaining: remainingBefore,
      policy: previewPolicy,
      walletAddress: buy.buyer as HexAddress,
      activeDefendedStreak: preBuyStreak,
      recentBuys: priorBuys,
    });

    if (fx.streak && isFeatureUnlocked(levelNum, "defended_streak")) {
      items.push(formatPreviewStreakPill(fx.streak));
    }
    if (isFeatureUnlocked(levelNum, "warbow")) {
      for (const bp of fx.bpPills) {
        items.push(formatPreviewBpPill(bp));
      }
    }
  }

  if (buy.flag_planted && isFeatureUnlocked(levelNum, "warbow_flag")) {
    items.push("Plant flag");
  }

  items.push("Last Buyer");

  return items;
}

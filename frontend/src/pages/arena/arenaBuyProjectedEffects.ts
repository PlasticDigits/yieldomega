// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import { shortAddress } from "@/lib/addressFormat";
import { xpForCharm } from "@/lib/arenaXpMath";
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
import { isFeatureUnlocked, MAX_PLAYER_LEVEL } from "@/lib/arenaProgression";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** XP preview from cleared CHARM weight (mirrors onchain `ArenaXp.xpForCharm`). */
export function formatBuyProjectedXpLine(charmWad: bigint): string {
  return `+${formatLocaleInteger(xpForCharm(charmWad).toString())}xp`;
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
    formatRivalWallet,
  } = args;

  const levelNum =
    typeof playerLevel === "bigint" ? Number(playerLevel) : playerLevel ?? MAX_PLAYER_LEVEL;

  const items: string[] = [];

  const charmLineWad = charmWeightTotalWad ?? charmWadSelected;
  if (charmLineWad !== undefined && charmLineWad > 0n) {
    items.push(formatBuyProjectedXpLine(charmLineWad));
  }

  if (secondsRemaining === undefined) {
    items.push("Timer pending");
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

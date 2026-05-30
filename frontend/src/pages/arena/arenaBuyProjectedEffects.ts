// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import type { BuyItem } from "@/lib/indexerApi";
import { formatBuyHubDerivedCompact } from "@/lib/timeArenaBuyHubFormat";
import {
  type TimeCurveBuyPreviewPolicy,
  formatPreviewBpPill,
  formatPreviewStreakPill,
  formatPreviewTimerPill,
  previewWarbowBuyEffects,
} from "@/lib/timeArenaBuyPreview";
import { formatUnits } from "viem";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

/** Spend chip: negative fixed 3-decimal amount + asset label (GitLab #227). */
export function formatBuyProjectedSpendLine(
  spendWei: bigint,
  decimals: number,
  assetLabel: string,
): string {
  const plain = formatUnits(spendWei, decimals);
  const [whole, frac = ""] = plain.split(".");
  const frac3 = frac.padEnd(3, "0").slice(0, 3);
  return `-${whole}.${frac3} ${assetLabel}`;
}

export type BuildTimeCurveBuyProjectedEffectLinesArgs = {
  charmWadSelected?: bigint;
  /**
   * When set, used for the "+X CHARM" chip instead of {@link charmWadSelected}
   * (e.g. cleared `charmWad` plus referral / presale CHARM-weight bonuses).
   */
  charmWeightTotalWad?: bigint;
  estimatedSpendWei?: bigint;
  decimals: number;
  /** Pay asset label for spend chip, e.g. `CL8Y`, `ETH`, `USDM`. */
  spendAssetLabel?: string;
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
  previewPolicy?: TimeCurveBuyPreviewPolicy;
  /** `formatWallet(addr, "rival")` on Arena; Simple may use {@link shortAddress}. */
  formatRivalWallet: (addr: HexAddress) => string;
};

/**
 * Narrative chips for the buy checkout “projected effects” rail — shared by
 * TimeCurve Simple and Arena so the copy stays aligned with the live sizing
 * reads (issue #82 / #191 / #227).
 */
export function buildArenaBuyProjectedEffectLines(
  args: BuildTimeCurveBuyProjectedEffectLinesArgs,
): string[] {
  const {
    charmWadSelected,
    charmWeightTotalWad,
    estimatedSpendWei,
    decimals,
    spendAssetLabel = "CL8Y",
    secondsRemaining,
    activeDefendedStreak,
    plantWarBowFlag,
    flagOwnerAddr,
    flagPlantAtSec,
    walletAddress,
    recentBuys,
    previewPolicy,
    formatRivalWallet,
  } = args;

  const items: string[] = [];

  const charmLineWad = charmWeightTotalWad ?? charmWadSelected;
  if (charmLineWad !== undefined && charmLineWad > 0n) {
    items.push(`+${formatBuyHubDerivedCompact(charmLineWad, 18)} CHARM`);
  }
  if (estimatedSpendWei !== undefined && estimatedSpendWei > 0n) {
    items.push(formatBuyProjectedSpendLine(estimatedSpendWei, decimals, spendAssetLabel));
  }

  if (secondsRemaining === undefined) {
    items.push("Timer effect pending");
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
    if (fx.streak) {
      items.push(formatPreviewStreakPill(fx.streak));
    }
    for (const bp of fx.bpPills) {
      items.push(formatPreviewBpPill(bp));
    }
  }

  if (plantWarBowFlag) {
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
      items.push("Refresh your pending WarBow flag (resets silence timer)");
    } else if (hasPendingFlag && flagOwnerAddr !== undefined) {
      items.push(`Replace ${formatRivalWallet(flagOwnerAddr)}'s pending flag`);
    } else {
      items.push("Plant pending WarBow flag");
    }
  }

  items.push("Become Last Buyer");

  return items;
}

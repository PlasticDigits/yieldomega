// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import { formatBuyHubDerivedCompact } from "@/lib/timeCurveBuyHubFormat";
import { formatLocaleInteger } from "@/lib/formatAmount";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000";

export type BuildTimeCurveBuyProjectedEffectLinesArgs = {
  charmWadSelected?: bigint;
  /**
   * When set, used for the "+X CHARM" chip instead of {@link charmWadSelected}
   * (e.g. cleared `charmWad` plus referral / presale CHARM-weight bonuses).
   */
  charmWeightTotalWad?: bigint;
  estimatedSpendWei?: bigint;
  decimals: number;
  secondsRemaining?: number;
  timerExtensionPreview?: number;
  activeDefendedStreak?: bigint;
  plantWarBowFlag: boolean;
  flagOwnerAddr?: HexAddress;
  /** Pending flag plant time (seconds); treat missing as unset (no pending flag). */
  flagPlantAtSec?: bigint;
  walletAddress?: HexAddress;
  /** `formatWallet(addr, "rival")` on Arena; Simple may use {@link shortAddress}. */
  formatRivalWallet: (addr: HexAddress) => string;
};

/**
 * Narrative chips for the buy checkout “projected effects” rail — shared by
 * TimeCurve Simple and Arena so the copy stays aligned with the live sizing
 * reads (issue #82 / #191).
 */
export function buildTimeCurveBuyProjectedEffectLines(
  args: BuildTimeCurveBuyProjectedEffectLinesArgs,
): string[] {
  const {
    charmWadSelected,
    charmWeightTotalWad,
    estimatedSpendWei,
    decimals,
    secondsRemaining,
    timerExtensionPreview,
    activeDefendedStreak,
    plantWarBowFlag,
    flagOwnerAddr,
    flagPlantAtSec,
    walletAddress,
    formatRivalWallet,
  } = args;

  const items: string[] = [];

  const charmLineWad = charmWeightTotalWad ?? charmWadSelected;
  if (charmLineWad !== undefined && charmLineWad > 0n) {
    items.push(`+${formatBuyHubDerivedCompact(charmLineWad, 18)} CHARM`);
  }
  if (estimatedSpendWei !== undefined && estimatedSpendWei > 0n) {
    items.push(`${formatBuyHubDerivedCompact(estimatedSpendWei, decimals)} CL8Y spend`);
  }

  if (secondsRemaining === undefined) {
    items.push("Timer effect pending");
  } else if (secondsRemaining < 780) {
    items.push("Hard-reset timer toward 15m");
  } else if (timerExtensionPreview !== undefined && timerExtensionPreview > 0) {
    items.push(`+${formatLocaleInteger(timerExtensionPreview)}s timer`);
  }

  if (timerExtensionPreview !== undefined && timerExtensionPreview > 0) {
    items.push(`+${formatLocaleInteger(timerExtensionPreview)}s time-booster credit`);
  }

  if (secondsRemaining !== undefined && secondsRemaining < 900) {
    items.push(
      activeDefendedStreak !== undefined && activeDefendedStreak > 0n
        ? `Continue your streak (${formatLocaleInteger(activeDefendedStreak)} -> ${formatLocaleInteger(activeDefendedStreak + 1n)})`
        : "Start or break defended streak",
    );
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

  if (secondsRemaining !== undefined && secondsRemaining < 30) {
    items.push("+250 BP + reset/clutch bonuses");
  } else if (secondsRemaining !== undefined && secondsRemaining < 780) {
    items.push("+250 BP + reset bonus");
  } else {
    items.push("+250 BP base");
  }
  items.push("Become latest buyer");

  return items;
}

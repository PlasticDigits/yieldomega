// SPDX-License-Identifier: AGPL-3.0-only

import {
  WARBOW_FLAG_CLAIM_BP,
  WARBOW_FLAG_SILENCE_SEC,
  WARBOW_GUARD_DURATION_SEC,
  WARBOW_MAX_STEALS_PER_DAY,
  WARBOW_REVENGE_WINDOW_SEC,
  WARBOW_STEAL_DRAIN_BPS,
  WARBOW_STEAL_DRAIN_GUARDED_BPS,
} from "@/lib/arenaWarbowConstants";
import { FEATURE_UNLOCK_LEVEL } from "@/lib/arenaProgression";
import { formatLocaleInteger } from "@/lib/formatAmount";

export type WarbowHeroSubcardHelpTopic = "steal" | "guard" | "revenge" | "flag";

export type WarbowHeroSubcardHelpCopy = {
  title: string;
  body: string[];
};

const STEAL_DRAIN_PCT = WARBOW_STEAL_DRAIN_BPS / 100;
const GUARDED_DRAIN_PCT = WARBOW_STEAL_DRAIN_GUARDED_BPS / 100;
const FLAG_SILENCE_MIN = WARBOW_FLAG_SILENCE_SEC / 60;
const GUARD_DURATION_HOURS = WARBOW_GUARD_DURATION_SEC / (60 * 60);
const REVENGE_WINDOW_HOURS = WARBOW_REVENGE_WINDOW_SEC / (60 * 60);
const FLAG_PENALTY_BP = WARBOW_FLAG_CLAIM_BP * 2n;

export function warbowHeroSubcardHelpCopy(
  topic: WarbowHeroSubcardHelpTopic,
  opts: {
    stealCostLabel: string;
    guardCostLabel: string;
    bypassCostLabel: string;
    revengeCostLabel: string;
    maxStealsPerDay?: number;
  },
): WarbowHeroSubcardHelpCopy {
  const maxSteals = opts.maxStealsPerDay ?? WARBOW_MAX_STEALS_PER_DAY;

  switch (topic) {
    case "steal":
      return {
        title: "Steal",
        body: [
          `Spend ${opts.stealCostLabel} DOUB to drain Battle Points from a rival whose BP is between 2× and 10× yours.`,
          `A normal steal moves ${STEAL_DRAIN_PCT}% of their BP to you (${GUARDED_DRAIN_PCT}% if they have Guard active).`,
          `Each wallet can be stolen from ${formatLocaleInteger(maxSteals)} times per UTC day. Pay ${opts.bypassCostLabel} DOUB extra to bypass that cap.`,
          "Opens a one-time Revenge window for the victim.",
        ],
      };
    case "guard":
      return {
        title: "Guard",
        body: [
          `Spend ${opts.guardCostLabel} DOUB to activate a ${formatLocaleInteger(GUARD_DURATION_HOURS)}-hour shield.`,
          `While active, the next steal against you drains only ${GUARDED_DRAIN_PCT}% instead of ${STEAL_DRAIN_PCT}%.`,
          "Guard does not block steals — it only softens the drain.",
        ],
      };
    case "revenge":
      return {
        title: "Revenge",
        body: [
          `Spend ${opts.revengeCostLabel} DOUB once per open window (${formatLocaleInteger(REVENGE_WINDOW_HOURS)}h after you were stolen from).`,
          `Transfers ${STEAL_DRAIN_PCT}% of the stealer's current BP to you.`,
          "Each stealer has their own slot — pick one from the list or your selected steal target.",
        ],
      };
    case "flag":
      return {
        title: "Flag",
        body: [
          `Toggle Plant Flag on Next Buy (unlocks at Level ${FEATURE_UNLOCK_LEVEL.warbow_flag}). Your buy plants a pending flag.`,
          `After ${formatLocaleInteger(FLAG_SILENCE_MIN)} minutes with no other buys, claim for +${formatLocaleInteger(WARBOW_FLAG_CLAIM_BP)} BP (0 DOUB).`,
          `Another buy before silence ends clears your slot with no penalty. After silence but before you claim, an interrupt costs −${formatLocaleInteger(FLAG_PENALTY_BP)} BP.`,
        ],
      };
  }
}

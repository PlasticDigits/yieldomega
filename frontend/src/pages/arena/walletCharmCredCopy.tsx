// SPDX-License-Identifier: AGPL-3.0-only

import { FEATURE_UNLOCK_LEVEL, MAX_PLAYER_LEVEL } from "@/lib/arenaProgression";

export type WalletCharmCredHelpSection = {
  heading: string;
  body: string;
};

export function walletCharmCredHelpCopy(): {
  title: string;
  sections: readonly WalletCharmCredHelpSection[];
} {
  return {
    title: "Your wallet",
    sections: [
      {
        heading: "Levels",
        body: `Buyer level (1–${MAX_PLAYER_LEVEL}) gates which podium mechanics each buy activates—yours and everyone else's. Level ${FEATURE_UNLOCK_LEVEL.last_buy} unlocks Last Buy; Level ${FEATURE_UNLOCK_LEVEL.time_booster} adds Time Booster; Level ${FEATURE_UNLOCK_LEVEL.defended_streak} Defended Streak; Level ${FEATURE_UNLOCK_LEVEL.warbow} WarBow timer, BP, and steal/guard/revenge; Level ${FEATURE_UNLOCK_LEVEL.warbow_flag} WarBow flags. A level-1 player's buy only moves Last Buy; higher-level buyers unlock more podiums per buy.`,
      },
      {
        heading: "XP",
        body: "Experience from each CHARM buy scales from 1 XP at minimum CHARM (1.00) to 10 XP at maximum (10 CHARM). Level 1→2 needs 10 XP; each step grows by +5 until 100 XP per level, then stays flat. At max level, surplus XP is discarded. Timer and epoch rolls do not reset XP.",
      },
      {
        heading: "CHARM",
        body: "Your weight in the current Last Buy epoch from DOUB and CRED buys. Epoch CHARM is claim weight for that epoch's CRED pool — not a leaderboard score. Weight for a ended epoch clears when you claim CRED for it.",
      },
      {
        heading: "CRED",
        body: "Play CRED token. Each DOUB or CRED buy adds 35 CRED to the active Last Buy epoch pool. CRED Accrual previews your live share; after the epoch ends, Claim CRED pays pro-rata by epoch CHARM plus any fixed bonus. CRED Balance is spendable Play CRED in your wallet (buyWithCred burns 100 CRED per 1 CHARM).",
      },
    ],
  };
}

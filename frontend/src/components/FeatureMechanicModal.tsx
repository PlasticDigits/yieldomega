// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import {
  type ArenaFeatureKey,
  markFeatureTutorialSeen,
} from "@/lib/arenaProgression";

const COPY: Record<
  ArenaFeatureKey,
  { title: string; body: string }
> = {
  last_buy: {
    title: "Last Buy podium",
    body:
      "The three most recent buyers when the Last Buy timer hits zero share the epoch prize pool. Each buy moves you into 1st place and adds time to all four podium clocks.",
  },
  time_booster: {
    title: "Time Booster unlocked",
    body:
      "Your buys now extend the Time Booster podium timer and score toward the Time Booster leaderboard. Timer seconds added on Last Buy count toward your booster total.",
  },
  defended_streak: {
    title: "Defended Streak unlocked",
    body:
      "When the Last Buy timer is under 15 minutes and your buy adds time, you build a defended streak. Consecutive qualifying buys increase your streak score for the Defended Streak podium.",
  },
  warbow: {
    title: "WarBow unlocked",
    body:
      "Your buys extend the WarBow timer and earn Battle Points (BP). At Level 4 you can steal, guard, and revenge using onchain DOUB costs — see the WarBow panel for bands and limits.",
  },
  warbow_flag: {
    title: "WarBow flag unlocked",
    body:
      "You can plant a pending WarBow flag on buys (optional). After the silence window, claim the flag for bonus BP. Your buys can also cancel or replace another player's pending flag.",
  },
};

type Props = {
  feature: ArenaFeatureKey | null;
  onClose: () => void;
};

export function FeatureMechanicModal({ feature, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (feature) {
      if (!el.open) el.showModal();
      markFeatureTutorialSeen(feature);
    } else if (el.open) {
      el.close();
    }
  }, [feature]);

  if (!feature) return null;

  const { title, body } = COPY[feature];

  return (
    <dialog
      ref={dialogRef}
      className="feature-mechanic-modal"
      data-testid="feature-mechanic-modal"
      onClose={onClose}
    >
      <form method="dialog" className="feature-mechanic-modal__panel">
        <div className="feature-mechanic-modal__content">
          <h2 className="feature-mechanic-modal__title">{title}</h2>
          <p className="feature-mechanic-modal__body">{body}</p>
        </div>
        <footer className="feature-mechanic-modal__actions">
          <button type="submit" className="btn-secondary feature-mechanic-modal__action">
            Got it
          </button>
        </footer>
      </form>
    </dialog>
  );
}

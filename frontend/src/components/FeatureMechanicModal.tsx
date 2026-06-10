// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef } from "react";
import {
  type ArenaFeatureKey,
  markFeatureTutorialSeen,
} from "@/lib/arenaProgression";
import { podiumFeatureMechanicCopy } from "@/pages/arena/podiumCopy";

const COPY: Record<ArenaFeatureKey, { title: string; body: string[] }> = {
  last_buy: podiumFeatureMechanicCopy("last_buy") ?? {
    title: "Last Buy podium",
    body: [],
  },
  time_booster: {
    title: "Time Booster unlocked",
    body: podiumFeatureMechanicCopy("time_booster")?.body ?? [],
  },
  defended_streak: {
    title: "Defended Streak unlocked",
    body: podiumFeatureMechanicCopy("defended_streak")?.body ?? [],
  },
  warbow: {
    title: "WarBow unlocked",
    body: [
      ...(podiumFeatureMechanicCopy("warbow")?.body ?? []),
      "At Level 4 you can steal, guard, and revenge using onchain DOUB costs — see the WarBow panel for bands and limits.",
    ],
  },
  warbow_flag: {
    title: "WarBow flag unlocked",
    body: [
      "You can plant a pending WarBow flag on buys (optional). After the silence window, claim the flag for bonus BP. Your buys can also cancel or replace another player's pending flag.",
    ],
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
          {body.map((paragraph) => (
            <p key={paragraph} className="feature-mechanic-modal__body">
              {paragraph}
            </p>
          ))}
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

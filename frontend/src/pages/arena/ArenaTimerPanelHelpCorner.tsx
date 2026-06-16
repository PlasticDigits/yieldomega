// SPDX-License-Identifier: AGPL-3.0-only

import type { ArenaFeatureKey } from "@/lib/arenaProgression";

type Props = {
  podiumLabel: string;
  feature: ArenaFeatureKey;
  onFeatureHelp: (feature: ArenaFeatureKey) => void;
};

/** Top-right feature tutorial trigger beside the podium epoch stamp. */
export function ArenaTimerPanelHelpCorner({ podiumLabel, feature, onFeatureHelp }: Props) {
  return (
    <button
      type="button"
      className="arena-timer-chips__help arena-simple__timer-panel-help-corner"
      data-testid="arena-timer-panel-help"
      aria-label={`Open ${podiumLabel} tutorial`}
      onClick={() => onFeatureHelp(feature)}
    >
      ?
    </button>
  );
}

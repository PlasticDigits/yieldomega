// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import {
  type ArenaFeatureKey,
  FEATURE_UNLOCK_LEVEL,
  isFeatureUnlocked,
  lockedUntilLevelCopy,
} from "@/lib/arenaProgression";

type Props = {
  playerLevel: bigint | number | undefined;
  feature: ArenaFeatureKey;
  onHelp?: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
};

export function ArenaLevelGate({
  playerLevel,
  feature,
  onHelp,
  children,
  className,
  testId,
}: Props) {
  const unlocked =
    playerLevel !== undefined && isFeatureUnlocked(playerLevel, feature);
  const required = FEATURE_UNLOCK_LEVEL[feature];

  if (unlocked) {
    return (
      <div className={className} data-testid={testId}>
        {onHelp ? (
          <div className="arena-level-gate__help-row">
            <button
              type="button"
              className="arena-level-gate__help"
              aria-label={`Help: ${feature}`}
              onClick={onHelp}
            >
              ?
            </button>
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  return (
    <div
      className={className ? `${className} arena-level-gate arena-level-gate--locked` : "arena-level-gate arena-level-gate--locked"}
      data-testid={testId ?? `arena-level-gate-${feature}`}
      data-locked-level={required}
    >
      <div className="arena-level-gate__overlay" aria-hidden="true">
        <span className="arena-level-gate__lock" aria-hidden="true">
          🔒
        </span>
        <span className="arena-level-gate__copy">{lockedUntilLevelCopy(required)}</span>
      </div>
      <div className="arena-level-gate__content" aria-hidden="true">
        {children}
      </div>
    </div>
  );
}

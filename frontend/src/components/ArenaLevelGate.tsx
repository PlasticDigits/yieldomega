// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { LockedUntilLevel } from "@/components/LockedUntilLevel";
import {
  type ArenaFeatureKey,
  FEATURE_UNLOCK_LEVEL,
  isFeatureUnlocked,
  shouldShowLevelLock,
} from "@/lib/arenaProgression";

type Props = {
  playerLevel: bigint | number | undefined;
  feature: ArenaFeatureKey;
  children: ReactNode;
  className?: string;
  testId?: string;
};

export function ArenaLevelGate({
  playerLevel,
  feature,
  children,
  className,
  testId,
}: Props) {
  const unlocked =
    playerLevel !== undefined && isFeatureUnlocked(playerLevel, feature);
  const required = FEATURE_UNLOCK_LEVEL[feature];
  const showLock =
    !unlocked && shouldShowLevelLock(playerLevel, required);

  if (unlocked || !showLock) {
    return (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    );
  }

  return (
    <LockedUntilLevel
      requiredLevel={required}
      className={className ? `${className} arena-level-gate arena-level-gate--locked` : "arena-level-gate arena-level-gate--locked"}
      testId={testId ?? `arena-level-gate-${feature}`}
      detail="Buy CHARM to activate this mechanic."
    >
      {children}
    </LockedUntilLevel>
  );
}

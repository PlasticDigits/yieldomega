// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from "react";
import type { PodiumTransitionUxState } from "@/pages/arena/arenaTransitionState";

/**
 * Captures the podium epoch when a timer enters expiry/settling so
 * {@link derivePodiumTransitionState} can surface `epoch-advanced` after roll.
 */
export function usePodiumEpochLatch(
  transitionState: PodiumTransitionUxState,
  currentEpoch: string | undefined,
): string | undefined {
  const [latchedEpoch, setLatchedEpoch] = useState<string | undefined>();

  useEffect(() => {
    const inExpiry =
      transitionState === "expired-pending-roll" || transitionState === "settling";
    if (inExpiry) {
      setLatchedEpoch((prev) => prev ?? currentEpoch);
      return;
    }
    setLatchedEpoch(undefined);
  }, [transitionState, currentEpoch]);

  return latchedEpoch;
}

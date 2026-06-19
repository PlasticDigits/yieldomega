// SPDX-License-Identifier: AGPL-3.0-only

import type { ArenaSessionSummary } from "@/lib/indexerApi";

/** True when indexer session-summary has buys, podium updates, or epoch finals ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338)). */
export function hasWywaSummaryActivity(summary: ArenaSessionSummary): boolean {
  const totalBuys = Number(summary.total_buys);
  const podiumUpdates = Number(summary.podium_updates);
  return (
    (Number.isFinite(totalBuys) && totalBuys > 0) ||
    (Number.isFinite(podiumUpdates) && podiumUpdates > 0) ||
    (summary.podium_epochs_ended?.length ?? 0) > 0
  );
}

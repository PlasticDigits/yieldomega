// SPDX-License-Identifier: AGPL-3.0-only

import { ArenaVaultAddressesPanel } from "@/components/ArenaVaultAddressesPanel";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { addresses } from "@/lib/addresses";

/** DOUB buy routing: 100% to four podiums (25% each · 70/20/10 epoch tranches). */
export function FeeTransparency() {
  if (!addresses.timeArena) {
    return (
      <div className="fee-transparency">
        <StatusMessage variant="muted">
          Set <code>VITE_TIME_ARENA_ADDRESS</code> (and vault env vars) to show Arena prize routing.
        </StatusMessage>
      </div>
    );
  }

  return (
    <div
      className="fee-transparency"
      title="Each DOUB buy routes 100% to podium prize vaults: 25% per category, split 70% / 20% / 10% across current and next two epochs."
    >
      <div className="fee-transparency__rail" aria-label="Arena DOUB routing">
        <span>
          <strong>100%</strong>
          <em>podiums</em>
        </span>
        <span>
          <strong>25%</strong>
          <em>per track</em>
        </span>
        <span>
          <strong>70/20/10</strong>
          <em>epoch tranches</em>
        </span>
      </div>
      <ArenaVaultAddressesPanel />
    </div>
  );
}

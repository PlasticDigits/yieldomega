// SPDX-License-Identifier: AGPL-3.0-only

import { ArenaVaultAddressesPanel } from "@/components/ArenaVaultAddressesPanel";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { addresses } from "@/lib/addresses";

/** DOUB buy routing targets (40% active · 30% seed · 30% admin). */
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
      title="Each DOUB buy routes through onchain ArenaBuyRouting: 40% active podium, 30% seed podium, 30% admin sell vault."
    >
      <div className="fee-transparency__rail" aria-label="Arena DOUB routing">
        <span>
          <strong>40%</strong>
          <em>active</em>
        </span>
        <span>
          <strong>30%</strong>
          <em>seed</em>
        </span>
        <span>
          <strong>30%</strong>
          <em>admin</em>
        </span>
      </div>
      <ArenaVaultAddressesPanel />
    </div>
  );
}

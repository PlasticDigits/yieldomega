// SPDX-License-Identifier: AGPL-3.0-only

import { ArenaVaultAddressesPanel } from "@/components/ArenaVaultAddressesPanel";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { addresses } from "@/lib/addresses";

/** DOUB buy routing targets (40% active · 30% seed · 30% admin) — replaces legacy FeeRouter sinks. */
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
    <div className="fee-transparency">
      <p className="muted">
        <strong>Arena v2 prize vaults</strong> — each DOUB buy splits 40% active podium, 30% seed
        podium, 30% admin sell vault per onchain <code>ArenaBuyRouting</code>.
      </p>
      <ArenaVaultAddressesPanel />
    </div>
  );
}

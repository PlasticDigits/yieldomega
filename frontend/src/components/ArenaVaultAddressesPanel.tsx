// SPDX-License-Identifier: AGPL-3.0-only

import { MegaScannerAddressLink } from "@/components/MegaScannerAddressLink";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { addresses } from "@/lib/addresses";

const ARENA_VAULT_ROWS: { label: string; key: keyof typeof addresses }[] = [
  { label: "Time Arena", key: "timeArena" },
  { label: "Podium vaults", key: "podiumVaults" },
  { label: "Admin sell vault", key: "adminSellVault" },
];

/** Minimal Arena v2 vault list when `VITE_TIME_ARENA_ADDRESS` is set (GitLab #244). */
export function ArenaVaultAddressesPanel() {
  if (!addresses.timeArena) {
    return null;
  }

  const rows = ARENA_VAULT_ROWS.map(({ label, key }) => ({
    label,
    addr: addresses[key],
  })).filter((r): r is { label: string; addr: `0x${string}` } => Boolean(r.addr));

  if (rows.length === 0) {
    return (
      <StatusMessage variant="muted">
        Arena address configured; set optional <code>VITE_PODIUM_VAULTS_ADDRESS</code> /{" "}
        <code>VITE_ADMIN_SELL_VAULT_ADDRESS</code> for vault rows.
      </StatusMessage>
    );
  }

  return (
    <ul className="fee-sink-list">
      {rows.map(({ label, addr }) => (
        <li key={label}>
          <strong>{label}</strong>: <MegaScannerAddressLink address={addr} />
        </li>
      ))}
    </ul>
  );
}

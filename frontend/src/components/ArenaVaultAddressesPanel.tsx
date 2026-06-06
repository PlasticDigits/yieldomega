// SPDX-License-Identifier: AGPL-3.0-only

import { AddressInline } from "@/components/AddressInline";
import { StatusMessage } from "@/components/ui/StatusMessage";
import { addresses } from "@/lib/addresses";

const ARENA_VAULT_ROWS: { label: string; key: keyof typeof addresses }[] = [
  { label: "Time Arena", key: "timeArena" },
  { label: "Podium vaults", key: "podiumVaults" },
  { label: "Admin sell vault", key: "adminSellVault" },
];

/** Minimal Arena v2 address list with the standard blockie + explorer treatment. */
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
    <ul className="fee-sink-list arena-vault-addresses" aria-label="Arena contract addresses">
      {rows.map(({ label, addr }) => (
        <li key={label} className="arena-vault-addresses__row">
          <strong>{label}</strong>
          <AddressInline address={addr} tailHexDigits={6} size={18} className="arena-vault-addresses__addr" />
        </li>
      ))}
    </ul>
  );
}

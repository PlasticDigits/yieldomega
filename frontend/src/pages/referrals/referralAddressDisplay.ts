// SPDX-License-Identifier: AGPL-3.0-only

/** Normalize referral `ownerCode` bytes32 from wagmi for display. */
export function formatOwnerCodeHash(h: `0x${string}` | bigint): string {
  if (typeof h === "bigint") {
    return `0x${h.toString(16).padStart(64, "0")}`;
  }
  return h.toLowerCase();
}

/** Shorten `0x…` addresses for dense tables (full value in `title`). */
export function truncateHexAddress(addr: string, headChars = 6, tailChars = 4): string {
  const a = addr.trim();
  if (a.length <= 2 + headChars + tailChars) {
    return a;
  }
  return `${a.slice(0, 2 + headChars)}…${a.slice(-tailChars)}`;
}

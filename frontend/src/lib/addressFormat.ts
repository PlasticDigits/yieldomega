// SPDX-License-Identifier: AGPL-3.0-only

export function sameAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

export function shortAddress(value: string | undefined, fallback = "—"): string {
  if (!value) {
    return fallback;
  }
  return value.length > 12 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value;
}

/** Short wallet label for narrative copy (`shortAddress` or DotMega name). */
export type WalletFormatShort = (addr: string | undefined, fallback: string) => string;

/** Last `digits` hex characters only (no `0x`, no ellipsis); empty string if not a 20-byte hex address or `digits` invalid. */
export function addressTailHex(address: string, digits: number): string {
  const a = address.trim();
  const n = Math.min(40, Math.max(0, Math.floor(digits)));
  if (n < 1 || !/^0x[0-9a-fA-F]{40}$/.test(a)) {
    return "";
  }
  return a.slice(-n);
}

/** Last six hex digits only (no `0x`, no ellipsis); empty string if not a 20-byte hex address. */
export function addressLast6Hex(address: string): string {
  return addressTailHex(address, 6);
}

/** {@link WalletFormatShort} for ultra-compact UI (e.g. timer “last extension” chip). */
export const walletFormatAddressLast6: WalletFormatShort = (addr, fallback) => {
  if (!addr) {
    return fallback;
  }
  return addressLast6Hex(addr) || fallback;
};

/** Narrow-viewport sinks / trust rows: **`0xab…cdef`** (defaults 4 + 4 chars) for full `0x` + 20-byte hex; otherwise returns trimmed input (GitLab #93). */
export function abbreviateAddressEnds(
  address: string,
  headChars = 4,
  tailChars = 4,
  ellipsis = "…",
): string {
  const a = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(a)) {
    return a;
  }
  return `${a.slice(0, headChars)}${ellipsis}${a.slice(-tailChars)}`;
}

export function walletDisplayFromMap(nameByLower: ReadonlyMap<string, string>): WalletFormatShort {
  return (addr, fallback) => {
    if (!addr) {
      return fallback;
    }
    const name = nameByLower.get(addr.toLowerCase());
    if (name && name.trim().length > 0) {
      return name.trim();
    }
    return shortAddress(addr, fallback);
  };
}

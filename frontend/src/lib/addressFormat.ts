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

/** Short wallet label for narrative copy (`shortAddress` or DotMega name). */
export type WalletFormatShort = (addr: string | undefined, fallback: string) => string;

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

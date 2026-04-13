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

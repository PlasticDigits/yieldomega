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

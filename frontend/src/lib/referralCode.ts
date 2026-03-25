// SPDX-License-Identifier: AGPL-3.0-only

import { keccak256, stringToBytes } from "viem";

/** Matches `ReferralRegistry` normalization: lowercase A–Z, length 3–16, [a-z0-9]. */
export function normalizeReferralCode(raw: string): string {
  const t = raw.trim();
  if (t.length < 3 || t.length > 16) {
    throw new Error("Referral code must be 3–16 characters.");
  }
  let out = "";
  for (let i = 0; i < t.length; i++) {
    let c = t.charCodeAt(i);
    if (c >= 65 && c <= 90) {
      c += 32;
    }
    const ch = String.fromCharCode(c);
    if (!/^[a-z0-9]$/.test(ch)) {
      throw new Error("Referral code may only contain letters and digits.");
    }
    out += ch;
  }
  return out;
}

/** Same as `ReferralRegistry.hashCode` / `keccak256(bytes(normalized))`. */
export function hashReferralCode(raw: string): `0x${string}` {
  const n = normalizeReferralCode(raw);
  return keccak256(stringToBytes(n));
}

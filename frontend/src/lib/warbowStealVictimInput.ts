// SPDX-License-Identifier: AGPL-3.0-only

import { isAddress } from "viem";

/** User-visible copy for non-empty steal-victim input that is not a checksummable 40-hex address. */
export const WARBOW_STEAL_VICTIM_INVALID_ADDRESS = "Enter a valid victim address";

/** Shown after Attempt steal with an empty victim field (GitLab #195). */
export const WARBOW_STEAL_VICTIM_EMPTY_ATTEMPT = "Enter a victim address before attempting a steal.";

/**
 * When the field has partial/invalid hex, surface validation next to the input — not in the global Arena hint strip.
 * Empty input returns null so a fresh load shows no validation chrome (GitLab #195).
 */
export function warbowStealVictimInputFormatError(raw: string): string | null {
  const t = raw.trim();
  if (t.length === 0) {
    return null;
  }
  return isAddress(t) ? null : WARBOW_STEAL_VICTIM_INVALID_ADDRESS;
}

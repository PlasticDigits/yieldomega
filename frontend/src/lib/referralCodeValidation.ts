// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Client-side mirror of `ReferralRegistry._normalizeToBytes` validation rules
 * (`contracts/src/ReferralRegistry.sol` lines 86-94):
 *
 * - Length 3-16 characters after trim
 * - Charset a-z (lowercase) and 0-9 only
 *
 * Used by the register card (GitLab #208) to surface "invalid-length" / "invalid-charset"
 * status under the input before the user spends gas on a doomed registerCode tx. The
 * contract is still the source of truth — friendly mapping in `revertMessage.ts` remains
 * the backstop for the race / edge cases.
 */
export type ClientCodeValidation =
  | { kind: "empty" }
  | { kind: "invalid-length" }
  | { kind: "invalid-charset" }
  | { kind: "ok"; normalized: string };

const VALID_CHARSET = /^[a-z0-9]+$/;
const MIN_LEN = 3;
const MAX_LEN = 16;

export function validateCodeClientSide(input: string): ClientCodeValidation {
  const trimmed = input.trim();
  if (!trimmed) return { kind: "empty" };
  const lowered = trimmed.toLowerCase();
  if (lowered.length < MIN_LEN || lowered.length > MAX_LEN) return { kind: "invalid-length" };
  if (!VALID_CHARSET.test(lowered)) return { kind: "invalid-charset" };
  return { kind: "ok", normalized: lowered };
}

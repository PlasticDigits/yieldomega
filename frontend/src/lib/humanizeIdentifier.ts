// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Turns Solidity-ish labels into spaced title case:
 * `WARBOW_FLAG_SILENCE_SEC` → Warbow Flag Silence Sec
 * `warbowPendingFlagOwner` → Warbow Pending Flag Owner
 */

function capitalizeWord(w: string): string {
  if (!w) {
    return w;
  }
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function splitCamelSegments(token: string): string[] {
  const spaced = token
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2");
  return spaced.split(/\s+/).filter(Boolean);
}

/** Looks like `feeRouter`, `REFERRAL_EACH_BPS`, digit-suffixed names, etc. */
function looksLikeCodeToken(seg: string): boolean {
  if (!seg || !/^[A-Za-z0-9_]+$/.test(seg)) {
    return false;
  }
  if (seg.includes("_")) {
    return true;
  }
  if (/[a-z][A-Z]/.test(seg)) {
    return true;
  }
  if (/^[A-Z]{2,}/.test(seg)) {
    return true;
  }
  if (/[0-9]/.test(seg)) {
    return true;
  }
  if (/^[A-Z][a-z]+[A-Za-z0-9]*$/.test(seg)) {
    return true;
  }
  return /^[a-z]+$/.test(seg);
}

/** Humanize a single contract-style token (camel, snake, or single acronym-ish word). */
export function humanizeIdentifierToken(raw: string): string {
  const s = raw.trim();
  if (!s) {
    return s;
  }
  if (s.includes("_")) {
    return s.split("_").filter(Boolean).map(capitalizeWord).join(" ");
  }
  const segs = splitCamelSegments(s);
  if (segs.length >= 2 || (segs.length === 1 && segs[0] !== s)) {
    return segs.map(capitalizeWord).join(" ");
  }
  if (/^[A-Z][A-Z0-9]+$/.test(s) && !/[a-z]/.test(s)) {
    return capitalizeWord(s.toLowerCase());
  }
  return capitalizeWord(s);
}

/**
 * KV row label helper: detects trailing ` (note)`, multi-token identifiers like `charmPrice basePriceWad`,
 * and leaves prose like `seconds remaining` unchanged.
 */
export function humanizeKvLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return trimmed;
  }
  const trailing = /(\s\([^)]*\))$/.exec(trimmed);
  const body = trailing ? trimmed.slice(0, trailing.index).trimEnd() : trimmed;
  const noteSuffix = trailing?.[1] ?? "";

  const tokens = body.split(/\s+/).filter(Boolean);
  const multiLowercasePhrase =
    tokens.length > 1 && tokens.every((t) => /^[a-z]+$/.test(t));
  if (multiLowercasePhrase) {
    return trimmed;
  }

  const codeLike = tokens.length > 0 && tokens.every((t) => looksLikeCodeToken(t));
  if (!codeLike) {
    return trimmed;
  }
  const humanized = tokens.map(humanizeIdentifierToken).join(" · ");
  return humanized + noteSuffix;
}

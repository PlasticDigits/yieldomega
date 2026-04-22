// SPDX-License-Identifier: AGPL-3.0-only

import { extractReferralCodeFromPathname } from "@/lib/referralPathCapture";
import { normalizeReferralCode } from "@/lib/referralCode";

/** localStorage/sessionStorage key for captured referral (not a secret). */
const REF_STORAGE = "yieldomega.ref.v1";

const MY_REF_KEY_PREFIX = "yieldomega.myrefcode.v1." as const;

function writePendingToStores(code: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const payload = JSON.stringify({ code, ts: Date.now() });
    window.localStorage.setItem(REF_STORAGE, payload);
    window.sessionStorage.setItem(REF_STORAGE, payload);
  } catch {
    /* ignore quota / private mode */
  }
}

/** Try to capture a referral from the `?ref=` query. Query overrides path when both are valid. */
function captureFromRefQueryString(search: string): boolean {
  const ref = new URLSearchParams(search).get("ref")?.trim();
  if (!ref) {
    return false;
  }
  try {
    const normalized = normalizeReferralCode(ref);
    writePendingToStores(normalized);
    return true;
  } catch {
    return false;
  }
}

/**
 * On load and on client-side navigations, persist the pending referral: first `?ref=`
 * (if valid), else path-based `/code` or `/timecurve/code` when the segment is
 * a valid on-chain code shape (see `extractReferralCodeFromPathname`).
 */
export function applyReferralUrlCapture(pathname: string, search: string): void {
  if (typeof window === "undefined") {
    return;
  }
  if (captureFromRefQueryString(search)) {
    return;
  }
  const fromPath = extractReferralCodeFromPathname(pathname);
  if (fromPath) {
    writePendingToStores(fromPath);
  }
}

/**
 * @deprecated use `applyReferralUrlCapture` from a component with `useLocation` or pass `location.pathname` + `location.search` from `main.tsx`.
 */
export function captureReferralFromLocation(): void {
  if (typeof window === "undefined") {
    return;
  }
  applyReferralUrlCapture(window.location.pathname, window.location.search);
}

export function getPendingReferralCode(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(REF_STORAGE) ?? window.localStorage.getItem(REF_STORAGE);
    if (!raw) {
      return null;
    }
    const p = JSON.parse(raw) as { code?: string };
    return typeof p.code === "string" ? p.code : null;
  } catch {
    return null;
  }
}

export function clearPendingReferralCode(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(REF_STORAGE);
    window.sessionStorage.removeItem(REF_STORAGE);
  } catch {
    /* ignore */
  }
}

export function setStoredMyReferralCodeForWallet(address: `0x${string}`, code: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const key = `${MY_REF_KEY_PREFIX}${address.toLowerCase()}`;
    window.localStorage.setItem(
      key,
      JSON.stringify({ code: normalizeReferralCode(code), ts: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function getStoredMyReferralCodeForWallet(address: `0x${string}` | undefined): string | null {
  if (typeof window === "undefined" || !address) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(`${MY_REF_KEY_PREFIX}${address.toLowerCase()}`);
    if (!raw) {
      return null;
    }
    const p = JSON.parse(raw) as { code?: string };
    return typeof p.code === "string" ? p.code : null;
  } catch {
    return null;
  }
}

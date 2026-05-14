// SPDX-License-Identifier: AGPL-3.0-only

import { extractReferralCodeFromPathname } from "@/lib/referralPathCapture";
import { normalizeReferralCode } from "@/lib/referralCode";
import { isReferralSlugReservedForRouting } from "@/lib/referralPathReserved";

/** localStorage/sessionStorage key for captured referral (not a secret). */
const REF_STORAGE = "yieldomega.ref.v1";

const MY_REF_KEY_PREFIX = "yieldomega.myrefcode.v1." as const;

/**
 * If only one of `localStorage` / `sessionStorage` still holds the pending payload
 * (some hard-reloads, devtools, or browser quirks), copy it into the other so reads
 * stay consistent. When both differ, the entry with the newer `ts` wins and overwrites both.
 */
function syncPendingReferralAcrossStores(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const fromSession = window.sessionStorage.getItem(REF_STORAGE);
    const fromLocal = window.localStorage.getItem(REF_STORAGE);
    if (!fromSession && !fromLocal) {
      return;
    }
    if (fromSession && !fromLocal) {
      window.localStorage.setItem(REF_STORAGE, fromSession);
      return;
    }
    if (fromLocal && !fromSession) {
      window.sessionStorage.setItem(REF_STORAGE, fromLocal);
      return;
    }
    if (fromSession && fromLocal && fromSession !== fromLocal) {
      const tsOf = (raw: string): number => {
        try {
          const p = JSON.parse(raw) as { ts?: number };
          return typeof p.ts === "number" ? p.ts : 0;
        } catch {
          return 0;
        }
      };
      const winner = tsOf(fromLocal) >= tsOf(fromSession) ? fromLocal : fromSession;
      window.localStorage.setItem(REF_STORAGE, winner);
      window.sessionStorage.setItem(REF_STORAGE, winner);
    }
  } catch {
    /* ignore quota / private mode */
  }
}

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
    if (isReferralSlugReservedForRouting(normalized)) {
      return false;
    }
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
  syncPendingReferralAcrossStores();
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
  syncPendingReferralAcrossStores();
  try {
    /** Prefer local first: it survives tab close; session is kept in sync above. */
    const raw = window.localStorage.getItem(REF_STORAGE) ?? window.sessionStorage.getItem(REF_STORAGE);
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

/**
 * Predicate for the referrals footer pending pill (GitLab #205).
 * Returns true iff:
 * - The current pathname is the referrals page (`/referrals` exact match)
 * - There is a non-empty pending referral code locked in browser storage
 *
 * Extracted as a pure function so the component logic is unit-testable
 * without rendering React or mocking `window.location`.
 */
export function shouldShowPendingPill(pathname: string, code: string | null): boolean {
  if (pathname !== "/referrals") return false;
  if (!code) return false;
  if (code.trim().length === 0) return false;
  return true;
}

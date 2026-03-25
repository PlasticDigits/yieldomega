// SPDX-License-Identifier: AGPL-3.0-only

/** localStorage/sessionStorage key for captured ?ref= (not a secret). */
const REF_STORAGE = "yieldomega.ref.v1";

/** Persist pending referral code from `?ref=` (also mirrored in sessionStorage). */
export function captureReferralFromLocation(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref")?.trim();
    if (!ref) {
      return;
    }
    const normalized = ref.toLowerCase().replace(/\s+/g, "");
    if (normalized.length < 3) {
      return;
    }
    const payload = JSON.stringify({ code: normalized, ts: Date.now() });
    window.localStorage.setItem(REF_STORAGE, payload);
    window.sessionStorage.setItem(REF_STORAGE, payload);
  } catch {
    /* ignore quota / private mode */
  }
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

// SPDX-License-Identifier: AGPL-3.0-only

/** Per-browser last tab close timestamp for While You Were Away ([#338](https://gitlab.com/PlasticDigits/yieldomega/-/issues/338)). */
export const ARENA_LAST_CLOSED_AT_KEY = "yieldomega.arena.lastClosedAt.v1";

/** Minimum absence before showing the session summary modal. */
export const ARENA_SESSION_SUMMARY_MIN_ABSENT_MS = 60_000;

export function readArenaLastClosedAt(): number | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(ARENA_LAST_CLOSED_AT_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function writeArenaLastClosedAt(ms: number): void {
  if (typeof localStorage === "undefined") return;
  if (!Number.isFinite(ms) || ms <= 0) return;
  localStorage.setItem(ARENA_LAST_CLOSED_AT_KEY, String(Math.floor(ms)));
}

/** Whole seconds from elapsed milliseconds — human-readable absence copy. */
export function formatElapsedSinceMs(elapsedMs: number): string {
  const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${Math.max(totalSec, 1)}s`;
}

/** Persist close time on tab hide / page unload. Returns cleanup. */
export function installArenaSessionClosePersistence(): () => void {
  if (typeof window === "undefined") return () => {};

  const persist = () => writeArenaLastClosedAt(Date.now());

  const onVisibility = () => {
    if (document.visibilityState === "hidden") persist();
  };

  window.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", persist);

  return () => {
    window.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", persist);
  };
}

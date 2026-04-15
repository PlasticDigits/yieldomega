// SPDX-License-Identifier: AGPL-3.0-only

/**
 * When remaining is at or near the onchain timer cap (e.g. hard reset to ~15 minutes), snap to the
 * exact cap in seconds so the hero shows an even `…:MM:00` without fractional jitter.
 */
export function snapRemainingAtCap(snap: number, timerCapSec: number | undefined): number {
  if (timerCapSec !== undefined && snap >= timerCapSec - 1) {
    return timerCapSec;
  }
  return snap;
}

/** Whole seconds only — `HH:MM:SS` (no sub-second digits). */
export function formatCountdown(totalSec: number): string {
  const totalWhole = Math.floor(Math.max(0, totalSec));
  const h = Math.floor(totalWhole / 3600);
  const m = Math.floor((totalWhole % 3600) / 60);
  const s = totalWhole % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function timerUrgencyClass(sec: number | undefined): string {
  if (sec === undefined) return "";
  const floorSec = Math.floor(sec);
  if (floorSec <= 300) return "timer-hero--critical";
  if (floorSec <= 3600) return "timer-hero--warning";
  return "";
}

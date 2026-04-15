// SPDX-License-Identifier: AGPL-3.0-only

/** HH:MM:SS plus centiseconds so the hero can tick at ~10ms without waiting for whole seconds. */
export function formatCountdown(totalSec: number): string {
  const clamped = Math.max(0, totalSec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const cs = Math.min(99, Math.floor((clamped % 1) * 100));
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

export function timerUrgencyClass(sec: number | undefined): string {
  if (sec === undefined) return "";
  const floorSec = Math.floor(sec);
  if (floorSec <= 300) return "timer-hero--critical";
  if (floorSec <= 3600) return "timer-hero--warning";
  return "";
}

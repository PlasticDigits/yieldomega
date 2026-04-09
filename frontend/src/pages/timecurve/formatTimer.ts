// SPDX-License-Identifier: AGPL-3.0-only

export function formatCountdown(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function timerUrgencyClass(sec: number | undefined): string {
  if (sec === undefined) return "";
  if (sec <= 300) return "timer-hero--critical";
  if (sec <= 3600) return "timer-hero--warning";
  return "";
}

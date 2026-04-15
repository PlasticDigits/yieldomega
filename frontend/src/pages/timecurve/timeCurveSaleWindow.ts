// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Right edge of the live chart x-axis in **seconds since sale launch**:
 * `max(1, elapsedLive × 3)` so the current moment sits at **one third** of the span.
 */
export function elapsedChartAxisMaxSeconds(elapsedLiveSinceLaunchSec: number): number {
  const e = Math.max(0, elapsedLiveSinceLaunchSec);
  return Math.max(1, e * 3);
}

/** Formats elapsed seconds as HH:MM:SS (time since launch on chart axis). */
export function formatElapsedHms(totalSeconds: number): string {
  const s = Math.floor(Math.max(0, totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Visible unix-time window such that `nowSec` sits at **one third** of the span
 * (current moment pinned to 1/3 along the x-axis). Clamped to [saleStart, deadline].
 */
export function visibleSaleTimeWindow(
  saleStartSec: number,
  deadlineSec: number,
  nowSec: number,
): { left: number; right: number } {
  const total = Math.max(1, deadlineSec - saleStartSec);
  let left = nowSec - total / 3;
  let right = nowSec + (2 * total) / 3;
  if (left < saleStartSec) {
    left = saleStartSec;
    right = Math.min(deadlineSec, left + total);
  }
  if (right > deadlineSec) {
    right = deadlineSec;
    left = Math.max(saleStartSec, right - total);
  }
  return { left, right };
}

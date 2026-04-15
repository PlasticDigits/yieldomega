// SPDX-License-Identifier: AGPL-3.0-only

/** Minimum right edge of the live chart (seconds since launch). */
const MIN_LIVE_CHART_AXIS_SECONDS = 24 * 3600;

const TWENTY_MINUTES_SEC = 20 * 60;

/**
 * Right edge of the live chart x-axis in **seconds since sale launch**:
 * `max(24h, elapsedLive × 3)`, then **rounded down** to a multiple of 20 minutes (still at least 24h).
 */
export function elapsedChartAxisMaxSeconds(elapsedLiveSinceLaunchSec: number): number {
  const e = Math.max(0, elapsedLiveSinceLaunchSec);
  const raw = Math.max(MIN_LIVE_CHART_AXIS_SECONDS, e * 3);
  const roundedDown =
    Math.floor(raw / TWENTY_MINUTES_SEC) * TWENTY_MINUTES_SEC;
  return Math.max(MIN_LIVE_CHART_AXIS_SECONDS, roundedDown);
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

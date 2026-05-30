// SPDX-License-Identifier: AGPL-3.0-only

/** Whole seconds — `mm:ss` (both segments zero-padded to 2 digits; minutes grow past 99 as needed). */
export function formatMmSsCountdown(totalSec: number): string {
  const totalWhole = Math.floor(Math.max(0, totalSec));
  const m = Math.floor(totalWhole / 60);
  const s = totalWhole % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Whole seconds only — `HH:MM:SS` (no sub-second digits). */
export function formatCountdown(totalSec: number): string {
  const totalWhole = Math.floor(Math.max(0, totalSec));
  const h = Math.floor(totalWhole / 3600);
  const m = Math.floor((totalWhole % 3600) / 60);
  const s = totalWhole % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Split a duration into a whole-day count + `HH:MM:SS` for the remainder.
 *
 * Used by long-form countdown UIs (the standalone launch-countdown page and
 * the `/timecurve` simple timer hero) so that 24h+ durations don't render as
 * an awkward `48:13:07` — the days segment becomes its own bordered chip,
 * and the clock always stays in `HH:MM:SS < 24h` form.
 *
 * Returns `{ days: 0, clock: "HH:MM:SS" }` for sub-day durations so callers
 * can simply gate the days chip on `days > 0`.
 */
export function formatLaunchCountdown(totalSec: number): {
  days: number;
  clock: string;
} {
  const safe = Math.max(0, Math.floor(totalSec));
  const days = Math.floor(safe / 86400);
  const remainder = safe - days * 86400;
  return { days, clock: formatCountdown(remainder) };
}

export function timerUrgencyClass(sec: number | undefined): string {
  if (sec === undefined) return "";
  const floorSec = Math.floor(sec);
  if (floorSec <= 300) return "timer-hero--critical";
  if (floorSec <= 3600) return "timer-hero--warning";
  return "";
}

/** When |head block.timestamp − wall clock| exceeds this, show a chain-vs-device notice (mainnet usually stays under). */
export const CHAIN_WALL_SKEW_WARN_SEC = 120;

/**
 * Human-readable notice when chain head time and the browser clock disagree (common on local Anvil / warped devnets).
 * `skewSec` = `blockTimestampSec - floor(Date.now()/1000)` at the same instant.
 */
export function describeChainWallClockSkew(skewSec: number): string | null {
  if (!Number.isFinite(skewSec) || Math.abs(skewSec) <= CHAIN_WALL_SKEW_WARN_SEC) {
    return null;
  }
  const abs = Math.abs(Math.round(skewSec));
  const d = Math.floor(abs / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  let span: string;
  if (d >= 1) {
    span = h > 0 ? `~${d}d ${h}h` : `~${d}d`;
  } else if (h >= 1) {
    span = m > 0 ? `~${h}h ${m}m` : `~${h}h`;
  } else {
    span = `~${Math.max(1, m)}m`;
  }
  return skewSec > 0
    ? `Chain head time is ${span} ahead of your device clock. The countdown uses chain time (block.timestamp), not your system clock.`
    : `Chain head time is ${span} behind your device clock. The countdown uses chain time (block.timestamp), not your system clock.`;
}

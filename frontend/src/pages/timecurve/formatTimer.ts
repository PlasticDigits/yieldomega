// SPDX-License-Identifier: AGPL-3.0-only

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

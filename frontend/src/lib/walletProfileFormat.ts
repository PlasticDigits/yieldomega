// SPDX-License-Identifier: AGPL-3.0-only

/** Indexer `prizes_won[].podium` / `highest_scores[].podium` keys → UX labels. */
const PODIUM_KEY_LABELS: Record<string, string> = {
  last_buy: "Last Buy",
  time_booster: "Time Booster",
  defended_streak: "Defended Streak",
  warbow: "WarBow",
};

export function walletProfilePodiumLabel(key: string): string {
  return PODIUM_KEY_LABELS[key] ?? key.replace(/_/g, " ");
}

/** Indexer `podium_win_rate` is a 0–1 fraction string (e.g. `"0.2500"`). */
export function formatWalletProfileWinRate(raw: string | undefined): string {
  if (!raw?.trim()) return "—";
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

export function formatWalletProfileUnixSec(sec: string | null | undefined): string {
  if (!sec?.trim()) return "—";
  try {
    const ms = Number(BigInt(sec.trim())) * 1000;
    if (!Number.isFinite(ms)) return "—";
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

export function formatWalletProfileRankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}

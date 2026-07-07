// SPDX-License-Identifier: AGPL-3.0-only

import type { HexAddress } from "@/lib/addresses";
import { formatLocaleInteger } from "@/lib/formatAmount";
import type { BuyItem } from "@/lib/indexerApi";
import type { ArenaBuyPreviewPolicy } from "@/lib/timeArenaBuyPreview";
import {
  resolveArenaBuyEffectToastLines,
  type ResolveArenaBuyEffectToastLinesArgs,
} from "@/pages/arena/arenaBuyEffectToastLines";

export type ArenaBuyShareRowTone =
  | "timer"
  | "xp"
  | "level"
  | "warbow"
  | "flag"
  | "rank"
  | "streak";

export type ArenaBuyShareRow = {
  icon?: string;
  label: string;
  value: string;
  tone?: ArenaBuyShareRowTone;
};

export type ArenaBuyShareSummary = {
  headline: string;
  rows: ArenaBuyShareRow[];
  txHash?: string;
  shareText: string;
  /** Preview snapshot before indexer head buy resolves for the viewer wallet. */
  pending?: boolean;
};

const MAX_SHARE_ROWS = 7;

/** Compact timer copy for share headline and rows (e.g. `+2m 14s`). */
export function formatShareTimerSeconds(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  if (whole < 60) {
    return `+${formatLocaleInteger(whole)}s`;
  }
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  if (remainder === 0) {
    return `+${formatLocaleInteger(minutes)}m`;
  }
  return `+${formatLocaleInteger(minutes)}m ${formatLocaleInteger(remainder)}s`;
}

function parseTimerSeconds(line: string): number | undefined {
  const match = line.match(/^\+(\d+)s$/);
  if (!match) return undefined;
  return Number(match[1]);
}

function parseXpAmount(line: string): string | undefined {
  const match = line.match(/^\+(\d+)xp$/i);
  return match?.[1];
}

function parseBpAmount(line: string): { amount: number; label: string } | undefined {
  const match = line.match(/^\+(\d+) BP (.+)$/);
  if (!match) return undefined;
  return { amount: Number(match[1]), label: match[2]! };
}

function lineTone(line: string): ArenaBuyShareRowTone | undefined {
  if (line.includes("->") && line.includes("Level")) return "level";
  if (line.includes(" BP ")) return "warbow";
  if (line.toLowerCase().includes("flag")) return "flag";
  if (line.toLowerCase().includes("streak")) return "streak";
  if (line === "Last Buyer") return "rank";
  if (line.endsWith("xp")) return "xp";
  if (line.startsWith("+") && line.endsWith("s")) return "timer";
  return undefined;
}

function collapseEffectLinesToRows(lines: readonly string[]): ArenaBuyShareRow[] {
  const rows: ArenaBuyShareRow[] = [];
  const bpParts: string[] = [];
  let bpTotal = 0;

  for (const line of lines) {
    const timerSecs = parseTimerSeconds(line);
    if (timerSecs !== undefined) {
      rows.push({
        icon: "⏱",
        label: "Timer",
        value: formatShareTimerSeconds(timerSecs),
        tone: "timer",
      });
      continue;
    }

    const xp = parseXpAmount(line);
    if (xp !== undefined) {
      rows.push({
        icon: "⚡",
        label: "XP",
        value: `+${formatLocaleInteger(xp)}`,
        tone: "xp",
      });
      continue;
    }

    if (line.includes("->") && line.includes("Level")) {
      const levelMatch = line.match(/^(\d+)->(\d+) Level/);
      rows.push({
        icon: "⬆",
        label: "Level",
        value: levelMatch ? `${levelMatch[1]} → ${levelMatch[2]}` : line,
        tone: "level",
      });
      continue;
    }

    const bp = parseBpAmount(line);
    if (bp) {
      bpTotal += bp.amount;
      bpParts.push(bp.label);
      continue;
    }

    if (line.toLowerCase().includes("streak")) {
      rows.push({
        icon: "🛡",
        label: "Streak",
        value: line,
        tone: "streak",
      });
      continue;
    }

    if (line.toLowerCase().includes("flag")) {
      rows.push({
        icon: "🚩",
        label: "WarBow",
        value: line,
        tone: "flag",
      });
      continue;
    }

    if (line === "Last Buyer") {
      rows.push({
        icon: "🏆",
        label: "Rank",
        value: "Last Buyer",
        tone: "rank",
      });
      continue;
    }

    if (line === "START TIMER" || line === "Timer pending" || line === "Timer capped") {
      rows.push({
        icon: "⏱",
        label: "Timer",
        value: line,
        tone: "timer",
      });
      continue;
    }

    const tone = lineTone(line);
    if (tone) {
      rows.push({ label: "Effect", value: line, tone });
    }
  }

  if (bpTotal > 0) {
    const detail =
      bpParts.length === 1
        ? bpParts[0]!
        : bpParts.length > 1
          ? `${bpParts.slice(0, 2).join(" + ")}${bpParts.length > 2 ? ` +${bpParts.length - 2}` : ""}`
          : "WarBow";
    rows.push({
      icon: "⚔",
      label: "Battle points",
      value: `+${formatLocaleInteger(bpTotal)} BP (${detail})`,
      tone: "warbow",
    });
  }

  return rows.slice(0, MAX_SHARE_ROWS);
}

function buildShareHeadline(rows: readonly ArenaBuyShareRow[]): string {
  const parts: string[] = [];
  const timer = rows.find((row) => row.tone === "timer");
  const rank = rows.find((row) => row.tone === "rank");
  const warbow = rows.find((row) => row.tone === "warbow");

  if (timer) {
    parts.push(`${timer.icon ?? "⏱"} ${timer.value}`);
  }
  if (rank) {
    parts.push(`${rank.icon ?? "🏆"} ${rank.value}`);
  }
  if (warbow) {
    const bpMatch = warbow.value.match(/^\+([\d,]+) BP/);
    if (bpMatch) {
      parts.push(`+${bpMatch[1]} BP`);
    }
  }
  if (parts.length === 0 && rows[0]) {
    parts.push(rows[0].value);
  }
  return parts.join(" · ");
}

function buildShareText(
  headline: string,
  rows: readonly ArenaBuyShareRow[],
  txHash?: string,
): string {
  const lines = ["Yield Omega — Time Arena buy", headline];
  for (const row of rows) {
    if (row.tone === "rank") continue;
    const prefix = row.icon ? `${row.icon} ` : "";
    lines.push(`${prefix}${row.label}: ${row.value}`);
  }
  if (txHash) {
    lines.push(`Tx: ${txHash}`);
  }
  return lines.join("\n");
}

export type BuildArenaBuyShareSummaryArgs = ResolveArenaBuyEffectToastLinesArgs & {
  formatRivalWallet?: (addr: HexAddress) => string;
};

/** Collapse buy effect lines into a screenshot-ready share card (#365). */
export function buildArenaBuyShareSummary(
  args: BuildArenaBuyShareSummaryArgs,
): ArenaBuyShareSummary | null {
  const effectLines = resolveArenaBuyEffectToastLines(args);
  if (effectLines.length === 0) {
    return null;
  }
  const rows = collapseEffectLinesToRows(effectLines);
  if (rows.length === 0) {
    return null;
  }
  const headline = buildShareHeadline(rows);
  const txHash = args.indexedBuy?.tx_hash;
  return {
    headline,
    rows,
    txHash,
    shareText: buildShareText(headline, rows, txHash),
    pending: !args.indexedBuy,
  };
}

/** Stable card id for deduping indexer upgrades. */
export function arenaBuyShareSummaryId(
  buy: Pick<BuyItem, "tx_hash" | "log_index"> | undefined,
  batchId: string,
): string {
  if (buy) {
    return `${buy.tx_hash}-${buy.log_index}`;
  }
  return `preview-${batchId}`;
}

export type BuildArenaBuyShareSummaryContext = {
  recentBuys?: readonly BuyItem[] | null;
  previewPolicy?: ArenaBuyPreviewPolicy;
  playerLevel?: bigint | number;
  formatRivalWallet?: (addr: HexAddress) => string;
};

// SPDX-License-Identifier: AGPL-3.0-only

import { formatCompactDecimalString, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import type { ArenaWalletHighestScore, BuyItem } from "@/lib/indexerApi";
import { isAddress } from "viem";
import type { PodiumReadRow } from "./usePodiumReads";
import { formatTimeBoosterPodiumSec } from "./timeBoosterPodiumFormat";

const ZERO = "0x0000000000000000000000000000000000000000";

function sameViewerAddress(a: string | undefined, b: string | undefined): boolean {
  return Boolean(a && b && a.toLowerCase() === b.toLowerCase());
}

function isPodiumWinnerAddress(address: string | undefined): boolean {
  const raw = address?.trim();
  return Boolean(raw && isAddress(raw as `0x${string}`) && raw.toLowerCase() !== ZERO);
}

const WALLET_STATS_PODIUM_BY_UX_CATEGORY = ["last_buy", "warbow", "defended_streak", "time_booster"] as const;

/** Shown under Defended Streak when the on-chain podium value is zero or the slot has no winner yet. */
const SIMPLE_PODIUM_NO_DEFENDED_STREAK_SCORE_MSG =
  "Opens when Last Buy under 15 minutes";

/**
 * Plain-text score line for Simple reserve podium rows (shown under the address).
 * Last Buy uses the first three `recentBuys` rows when buyer order matches the podium slot
 * (same head ordering as indexer last-buy prediction).
 */
function parseUnixSecString(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const t = Number(BigInt(trimmed.split(".")[0]!));
    return Number.isFinite(t) ? t : null;
  } catch {
    const t = Math.floor(Number(trimmed));
    return Number.isFinite(t) ? t : null;
  }
}

function formatLastBuySecondsAgo(nowUnixSec: number, buySecRaw: string): string | null {
  try {
    const t = parseUnixSecString(buySecRaw);
    if (t === null) {
      return null;
    }
    if (!Number.isFinite(t)) {
      return null;
    }
    const delta = Math.max(0, Math.floor(nowUnixSec) - t);
    return `${delta}s`;
  } catch {
    return null;
  }
}

export function formatSimplePodiumScoreLine(
  categoryIndex: number,
  placeIndex: number,
  opts: {
    winner: string;
    winnerReady: boolean;
    valueRaw: string;
    nowUnixSec: number;
    /** Indexer `winner_buy_sec[place]` — preferred for Last Buy (schema ≥ 2.9.0). */
    winnerBuySec?: string | null;
    recentBuys?: readonly BuyItem[] | null;
    /** Compact surfaces (timer chips) show — instead of Defended Streak unlock guidance. */
    compact?: boolean;
  },
): string {
  if (categoryIndex === 2) {
    if (!opts.winnerReady) {
      return opts.compact ? "—" : SIMPLE_PODIUM_NO_DEFENDED_STREAK_SCORE_MSG;
    }
    let digits = "0";
    try {
      digits = rawToBigIntForFormat(opts.valueRaw || "0").toString();
    } catch {
      digits = "0";
    }
    if (digits === "0") {
      return opts.compact ? "—" : SIMPLE_PODIUM_NO_DEFENDED_STREAK_SCORE_MSG;
    }
    return `${digits} sequential buys`;
  }

  if (!opts.winnerReady) {
    return "—";
  }
  const w = opts.winner.trim().toLowerCase();
  if (!w || w === ZERO) {
    return "—";
  }

  if (categoryIndex === 0) {
    const indexedSec = opts.winnerBuySec?.trim();
    if (indexedSec) {
      const fromIndexer = formatLastBuySecondsAgo(opts.nowUnixSec, indexedSec);
      if (fromIndexer) {
        return fromIndexer;
      }
    }
    const b = opts.recentBuys?.[placeIndex];
    if (!b?.block_timestamp?.trim()) {
      return "—";
    }
    if (b.buyer.trim().toLowerCase() !== w) {
      return "—";
    }
    const fromRecent = formatLastBuySecondsAgo(opts.nowUnixSec, b.block_timestamp);
    return fromRecent ?? "—";
  }

  let digits = "0";
  try {
    digits = rawToBigIntForFormat(opts.valueRaw || "0").toString();
  } catch {
    digits = "0";
  }

  if (categoryIndex === 1) {
    return `${formatCompactDecimalString(digits, { sigfigs: 3 })} BP`;
  }
  if (categoryIndex === 3) {
    if (digits === "0") {
      return "—";
    }
    return `+${formatTimeBoosterPodiumSec(rawToBigIntForFormat(digits))}`;
  }
  return "—";
}

export function resolveViewerPodiumValueRaw(
  categoryIndex: number,
  row: PodiumReadRow | undefined,
  viewerAddress: string | undefined,
  opts: {
    activeDefendedStreak?: bigint;
    recentBuys?: readonly BuyItem[] | null;
    walletHighestScores?: readonly ArenaWalletHighestScore[] | null;
  },
): string | null {
  if (!viewerAddress?.trim()) {
    return null;
  }
  const viewer = viewerAddress.trim().toLowerCase();
  const winners = row?.winners ?? [];
  const values = row?.values ?? [];
  for (let i = 0; i < 3; i += 1) {
    const winner = winners[i];
    if (winner && isPodiumWinnerAddress(winner) && sameViewerAddress(winner, viewer)) {
      return values[i] ?? "0";
    }
  }

  if (categoryIndex === 2 && opts.activeDefendedStreak !== undefined) {
    return opts.activeDefendedStreak.toString();
  }

  if (categoryIndex === 1) {
    for (const buy of opts.recentBuys ?? []) {
      if (sameViewerAddress(buy.buyer, viewer) && buy.battle_points_after?.trim()) {
        return buy.battle_points_after;
      }
    }
  }

  if (categoryIndex === 3) {
    const epoch = row?.epoch;
    const podiumKey = WALLET_STATS_PODIUM_BY_UX_CATEGORY[categoryIndex];
    const match = opts.walletHighestScores?.find(
      (rowScore) =>
        rowScore.podium === podiumKey && (epoch === undefined || rowScore.epoch === epoch),
    );
    if (match?.score?.trim()) {
      return match.score;
    }
  }

  return "0";
}

/** Connected-wallet score line — same copy rhythm as podium `meta` rows. */
export function formatViewerPodiumScoreLine(
  categoryIndex: number,
  valueRaw: string | null,
  opts: { nowUnixSec: number; walletConnected: boolean },
): string {
  if (!opts.walletConnected) {
    return "—";
  }
  if (valueRaw === null) {
    return "—";
  }
  return formatSimplePodiumScoreLine(categoryIndex, 0, {
    winner: "0x0000000000000000000000000000000000000001",
    winnerReady: true,
    valueRaw,
    nowUnixSec: opts.nowUnixSec,
  });
}

// SPDX-License-Identifier: AGPL-3.0-only

import { type QueryClient } from "@tanstack/react-query";
import { type Address, type Log, parseEventLogs } from "viem";
import {
  arenaWalletStatsQueryKey,
  ARENA_WALLET_STATS_QUERY_KEY,
} from "@/hooks/useWalletStats";
import { indexerBaseUrl } from "@/lib/addresses";
import { timeArenaXpGainedEventAbi } from "@/lib/abis";
import { applyXpGain, normalizeXpProgress, xpForCharm } from "@/lib/arenaXpMath";
import type { ArenaWalletStats } from "@/lib/indexerApi";

export function emptyArenaWalletStats(address: string): ArenaWalletStats {
  const w = address.trim().toLowerCase();
  return {
    address: w,
    epochs_participated: 0,
    buy_count: 0,
    total_spent_doub: "0",
    average_buy_doub: "0",
    max_single_buy_doub: "0",
    first_buy_at: null,
    xp: "0",
    level: "1",
    xp_toward_next: "0",
    unlocked_level: "1",
    last_buy_epoch: "0",
    epoch_charm_wad: "0",
    epoch_charm_total_wad: "0",
    epoch_buy_count: "0",
    epoch_doub_buy_count: "0",
    pending_cred_accrual: "0",
    claimable_cred_epoch: null,
    claimable_cred: "0",
    cred_balance_wad: "0",
    prizes_won: [],
    total_won_doub: "0",
    highest_scores: [],
    warbow_battle_points: "0",
    warbow_guard_until: "0",
    warbow_steals: 0,
    warbow_guards: 0,
    cred_claimed: "0",
    referral_cred_earned: "0",
    longest_defended_streak: "0",
    podium_win_rate: "0",
    rank_distribution: { "1": "0", "2": "0", "3": "0" },
    level_history: [
      { level: "1", reached_at: null },
      { level: "2", reached_at: null },
      { level: "3", reached_at: null },
      { level: "4", reached_at: null },
      { level: "5", reached_at: null },
    ],
  };
}

export function applyXpGainToWalletStats(
  stats: ArenaWalletStats | undefined,
  wallet: string,
  xpGain: bigint,
): ArenaWalletStats {
  const base = stats ?? emptyArenaWalletStats(wallet);
  const level = BigInt(base.level || "1");
  const toward = BigInt(base.xp_toward_next ?? "0");
  const totalXp = BigInt(base.xp || "0");
  const reconciled = normalizeXpProgress(level, toward);
  const next = applyXpGain(reconciled.level, reconciled.xpTowardNext, xpGain);
  const lvlStr = next.level.toString();
  return {
    ...base,
    address: base.address.toLowerCase(),
    level: lvlStr,
    xp_toward_next: next.xpTowardNext.toString(),
    xp: (totalXp + xpGain).toString(),
    unlocked_level: lvlStr,
  };
}

export function xpGainFromBuyReceiptLogs(
  logs: readonly Log[],
  timeArenaAddress: Address,
  wallet: string,
): bigint | null {
  const w = wallet.trim().toLowerCase();
  const parsed = parseEventLogs({
    abi: timeArenaXpGainedEventAbi,
    logs: [...logs],
    eventName: "XpGained",
  });
  for (const entry of parsed) {
    if (entry.eventName !== "XpGained") continue;
    const player = entry.args.player;
    if (!player || player.toLowerCase() !== w) continue;
    if (entry.address.toLowerCase() !== timeArenaAddress.toLowerCase()) continue;
    return entry.args.amount ?? null;
  }
  return null;
}

const CRED_PER_BUY_WAD = 35_000_000_000_000_000_000n;

function pendingCredDelta(
  weightBefore: bigint,
  weightAfter: bigint,
  totalBefore: bigint,
  totalAfter: bigint,
  epochBuysBefore: bigint,
  epochBuysAfter: bigint,
): bigint {
  const poolBefore = epochBuysBefore * CRED_PER_BUY_WAD;
  const poolAfter = epochBuysAfter * CRED_PER_BUY_WAD;
  const before =
    weightBefore > 0n && totalBefore > 0n
      ? (poolBefore * weightBefore) / totalBefore
      : 0n;
  const after =
    weightAfter > 0n && totalAfter > 0n ? (poolAfter * weightAfter) / totalAfter : 0n;
  return after > before ? after - before : 0n;
}

export function applyCharmCredBuyToWalletStats(
  stats: ArenaWalletStats | undefined,
  wallet: string,
  charmWad: bigint,
  paidWithCred: boolean,
): ArenaWalletStats {
  const base = stats ?? emptyArenaWalletStats(wallet);
  const weightBefore = BigInt(base.epoch_charm_wad ?? "0");
  const totalBefore = BigInt(base.epoch_charm_total_wad ?? "0");
  const weightAfter = weightBefore + charmWad;
  const totalAfter = totalBefore + charmWad;
  const epochBuysBefore = BigInt(
    base.epoch_buy_count ?? base.epoch_doub_buy_count ?? "0",
  );
  const epochBuysAfter = epochBuysBefore + 1n;
  const pending = BigInt(base.pending_cred_accrual ?? "0");
  const delta = pendingCredDelta(
    weightBefore,
    weightAfter,
    totalBefore,
    totalAfter,
    epochBuysBefore,
    epochBuysAfter,
  );
  let balance = BigInt(base.cred_balance_wad ?? "0");
  if (paidWithCred) {
    balance -= (charmWad * 100_000_000_000_000_000_000n) / 1_000_000_000_000_000_000n;
  }
  return {
    ...base,
    epoch_charm_wad: weightAfter.toString(),
    epoch_charm_total_wad: totalAfter.toString(),
    pending_cred_accrual: (pending + delta).toString(),
    cred_balance_wad: balance.toString(),
  };
}

export function optimisticArenaWalletXpGain(
  queryClient: QueryClient,
  wallet: string,
  xpGain: bigint,
) {
  const base = indexerBaseUrl();
  if (!base || xpGain <= 0n) return;
  const key = arenaWalletStatsQueryKey(base, wallet);
  queryClient.setQueryData<ArenaWalletStats | null>(key, (prev) =>
    applyXpGainToWalletStats(prev ?? undefined, wallet, xpGain),
  );
}

export function optimisticArenaWalletBuyStats(
  queryClient: QueryClient,
  wallet: string,
  charmWad: bigint,
  paidWithCred: boolean,
  xpGain?: bigint,
) {
  const base = indexerBaseUrl();
  if (!base || charmWad <= 0n) return;
  const key = arenaWalletStatsQueryKey(base, wallet);
  const gain = xpGain ?? xpForCharm(charmWad);
  queryClient.setQueryData<ArenaWalletStats | null>(key, (prev) => {
    const withXp = applyXpGainToWalletStats(prev ?? undefined, wallet, gain);
    return applyCharmCredBuyToWalletStats(withXp, wallet, charmWad, paidWithCred);
  });
}

export function invalidateArenaWalletStatsQueries(queryClient: QueryClient) {
  if (!indexerBaseUrl()) return;
  void queryClient.invalidateQueries({
    queryKey: [ARENA_WALLET_STATS_QUERY_KEY],
    refetchType: "active",
  });
}

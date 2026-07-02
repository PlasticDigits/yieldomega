// SPDX-License-Identifier: AGPL-3.0-only
/* eslint-disable react-refresh/only-export-components -- arena protocol data context + hooks */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { addresses, indexerBaseUrl, type HexAddress } from "@/lib/addresses";
import { mergeStickyMulticallRows, type MulticallReadRow } from "@/lib/mergeStickyMulticallRows";
import { useWalletStats, arenaWalletStatsQueryKey } from "@/hooks/useWalletStats";
import { useArenaHeroTimer } from "@/pages/arena/useArenaHeroTimer";
import {
  acceptedDoubFromTimers,
  mapArenaV2AdvancedCoreRowsFromArenaTimers,
  mapArenaV2AdvancedWarbowRowsFromSaleState,
  userSaleRowsFromWalletStats,
  warbowPodiumRowFromIndexerRows,
} from "@/pages/arena/arenaProtocolIndexerBridge";
import { ARENA_V2_ADVANCED_CORE_ROW_INDICES } from "@/pages/arena/arenaV2AdvancedSessionBridge";
import { usePodiumReads } from "@/pages/arena/usePodiumReads";
import { useArenaSaleStateQuery, useArenaTimersQuery } from "@/pages/arena/useArenaSaleState";
import type { ContractReadRow } from "@/lib/arenaPageHelpers";

/** TimeArena core reads exposed on the protocol page (mapped row labels). */
export const ARENA_PROTOCOL_CORE_READS = [
  "arenaStart",
  "deadline",
  "totalDoubRaised",
  "paused",
  "charmPriceWad",
  "doub",
  "referralRegistry",
  "timerExtensionSec",
  "timerCapSec",
  "buyCooldownSec",
  "timeArenaBuyRouter",
  "owner",
] as const;

/** Indices into merged `protocolReading` for common accessors. */
export const PROTOCOL_READING_INDICES = {
  doub: 5,
  paused: 19,
} as const;

function isNonZeroAddr(v: unknown): v is HexAddress {
  return typeof v === "string" && v.startsWith("0x") && v.length === 42 && v.toLowerCase() !== "0x0000000000000000000000000000000000000000";
}

/** Maps advanced core rows into the 27-row accordion shape (legacy indices preserved where possible). */
export function mapProtocolReadingToCoreTcData(
  coreRows: readonly ContractReadRow[] | undefined,
): readonly ContractReadRow[] | undefined {
  return coreRows;
}

export type ArenaProtocolDataContextValue = {
  arenaAddress: HexAddress | undefined;
  protocolReading: readonly ContractReadRow[];
  refetchProtocolReads: () => void;
  latchedAcceptedAssetAddr: HexAddress | undefined;
  coreTcDataForAccordion: readonly ContractReadRow[] | undefined;
  userSaleData: readonly ContractReadRow[] | undefined;
  /** Per-podium on-chain timer params — indexer-first: unavailable without browser RPC ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)). */
  podiumTimerAuditReads: readonly ContractReadRow[] | undefined;
  heroTimer: ReturnType<typeof useArenaHeroTimer>["heroTimer"];
  heroChainNowSec: number | undefined;
  refreshHeroTimer: () => void;
  refreshHeroTimerSoft: () => void;
  indexerConfigured: boolean;
};

const ArenaProtocolDataContext = createContext<ArenaProtocolDataContextValue | null>(null);

export function ArenaProtocolDataProvider({ children }: { children: ReactNode }) {
  const tc = addresses.timeArena;
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const indexerConfigured = Boolean(indexerBaseUrl());

  const tcReadsStickyRef = useRef<readonly MulticallReadRow[]>([]);
  const [latchedAccepted, setLatchedAccepted] = useState<HexAddress | undefined>(undefined);

  useEffect(() => {
    tcReadsStickyRef.current = [];
    setLatchedAccepted(undefined);
  }, [tc]);

  const timersQuery = useArenaTimersQuery(tc);
  const saleStateQuery = useArenaSaleStateQuery(tc, { enabled: indexerConfigured });
  const podiumReads = usePodiumReads(tc ?? undefined);
  const { data: walletStats } = useWalletStats(indexerConfigured ? address : undefined);

  const coreMapped = useMemo(
    () =>
      indexerConfigured && timersQuery.data
        ? mapArenaV2AdvancedCoreRowsFromArenaTimers(timersQuery.data)
        : undefined,
    [indexerConfigured, timersQuery.data],
  );

  const warbowMapped = useMemo(() => {
    if (!indexerConfigured || !saleStateQuery.data) {
      return undefined;
    }
    const warbowPodium = warbowPodiumRowFromIndexerRows(podiumReads.indexerRows);
    return mapArenaV2AdvancedWarbowRowsFromSaleState(saleStateQuery.data, warbowPodium);
  }, [indexerConfigured, podiumReads.indexerRows, saleStateQuery.data]);

  const userSaleData = useMemo(
    () => (indexerConfigured ? userSaleRowsFromWalletStats(walletStats ?? undefined) : undefined),
    [indexerConfigured, walletStats],
  );

  const readingLive = useMemo((): readonly ContractReadRow[] => {
    const core = coreMapped ?? [];
    const war = warbowMapped ?? [];
    return [...core, ...war];
  }, [coreMapped, warbowMapped]);

  const protocolReading = useMemo(() => {
    const merged = mergeStickyMulticallRows(readingLive, tcReadsStickyRef.current);
    tcReadsStickyRef.current = merged;
    return merged as readonly ContractReadRow[];
  }, [readingLive]);

  useEffect(() => {
    const doubFromTimers = acceptedDoubFromTimers(timersQuery.data ?? undefined);
    const doubRow = coreMapped?.[ARENA_V2_ADVANCED_CORE_ROW_INDICES.doub];
    const doub =
      doubFromTimers ??
      (doubRow?.status === "success" && isNonZeroAddr(doubRow.result)
        ? (doubRow.result as HexAddress)
        : undefined);
    if (!latchedAccepted && doub) {
      setLatchedAccepted(doub);
    }
  }, [coreMapped, latchedAccepted, timersQuery.data]);

  const {
    heroTimer,
    chainNowSec: heroChainNowSec,
    refresh: refreshHeroTimer,
    refreshSoft: refreshHeroTimerSoft,
  } = useArenaHeroTimer(tc);

  const coreTcDataForAccordion = useMemo(
    () => mapProtocolReadingToCoreTcData(coreMapped),
    [coreMapped],
  );

  const refetchProtocolReads = useCallback(() => {
    if (!indexerConfigured) {
      return;
    }
    void timersQuery.refetch();
    void saleStateQuery.refetch();
    void podiumReads.refetch();
    if (address) {
      void queryClient.invalidateQueries({
        queryKey: arenaWalletStatsQueryKey(indexerBaseUrl(), address),
      });
    }
  }, [address, indexerConfigured, podiumReads, queryClient, saleStateQuery, timersQuery]);

  const value = useMemo(
    (): ArenaProtocolDataContextValue => ({
      arenaAddress: tc ?? undefined,
      protocolReading,
      refetchProtocolReads,
      latchedAcceptedAssetAddr: latchedAccepted,
      coreTcDataForAccordion,
      userSaleData,
      podiumTimerAuditReads: undefined,
      heroTimer,
      heroChainNowSec,
      refreshHeroTimer,
      refreshHeroTimerSoft: refreshHeroTimerSoft,
      indexerConfigured,
    }),
    [
      tc,
      protocolReading,
      refetchProtocolReads,
      latchedAccepted,
      coreTcDataForAccordion,
      userSaleData,
      heroTimer,
      heroChainNowSec,
      refreshHeroTimer,
      refreshHeroTimerSoft,
      indexerConfigured,
    ],
  );

  return (
    <ArenaProtocolDataContext.Provider value={value}>{children}</ArenaProtocolDataContext.Provider>
  );
}

export function useArenaProtocolData(): ArenaProtocolDataContextValue {
  const ctx = useContext(ArenaProtocolDataContext);
  if (!ctx) {
    throw new Error("useArenaProtocolData must be used within ArenaProtocolDataProvider");
  }
  return ctx;
}

/** DOUB is always 18 decimals on Arena v2 — no browser `decimals()` poll ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)). */
export function useArenaProtocolAccordionTokenDecimals() {
  return 18;
}

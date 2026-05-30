// SPDX-License-Identifier: AGPL-3.0-only

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
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { erc20Abi, timeArenaReadAbi } from "@/lib/abis";
import { addresses, type HexAddress } from "@/lib/addresses";
import { useRpcQueryHealthForRefetch } from "@/hooks/useRpcQueryHealth";
import { getRpcBackoffPollMs } from "@/lib/rpcConnectivity";
import { mergeStickyMulticallRows, type MulticallReadRow } from "@/lib/mergeStickyMulticallRows";
import { useArenaHeroTimer } from "@/pages/arena/useArenaHeroTimer";
import {
  arenaV2AdvancedCoreContracts,
  arenaV2AdvancedWarbowContracts,
  mapArenaV2AdvancedCoreRows,
  mapArenaV2AdvancedWarbowRows,
} from "@/pages/arena/arenaV2AdvancedSessionBridge";
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
  buyFeeRoutingEnabled: 19,
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
  heroTimer: ReturnType<typeof useArenaHeroTimer>["heroTimer"];
  heroChainNowSec: number | undefined;
  refreshHeroTimer: () => void;
  refreshHeroTimerSoft: () => void;
};

const ArenaProtocolDataContext = createContext<ArenaProtocolDataContextValue | null>(null);

export function ArenaProtocolDataProvider({ children }: { children: ReactNode }) {
  const tc = addresses.timeArena;
  const { address } = useAccount();

  const tcReadsStickyRef = useRef<readonly MulticallReadRow[]>([]);
  const warbowReadsStickyRef = useRef<readonly MulticallReadRow[]>([]);

  const [latchedAccepted, setLatchedAccepted] = useState<HexAddress | undefined>(undefined);

  useEffect(() => {
    tcReadsStickyRef.current = [];
    warbowReadsStickyRef.current = [];
    setLatchedAccepted(undefined);
  }, [tc]);

  const coreContracts = tc ? [...arenaV2AdvancedCoreContracts(tc)] : [];
  const warbowContracts = tc ? [...arenaV2AdvancedWarbowContracts(tc)] : [];

  const coreReads = useReadContracts({
    contracts: coreContracts as readonly unknown[],
    query: {
      enabled: Boolean(tc),
      refetchInterval: () => getRpcBackoffPollMs(1000),
      placeholderData: (previous) => previous,
    },
  });

  useRpcQueryHealthForRefetch({
    isFetched: coreReads.isFetched,
    isFetching: coreReads.isFetching,
    isError: coreReads.isError,
    isSuccess: coreReads.isSuccess,
    error: coreReads.error,
  });

  const warbowReads = useReadContracts({
    contracts: warbowContracts as readonly unknown[],
    query: {
      enabled: Boolean(tc),
      refetchInterval: () => getRpcBackoffPollMs(1000),
      placeholderData: (previous) => previous,
    },
  });

  useRpcQueryHealthForRefetch({
    isFetched: warbowReads.isFetched,
    isFetching: warbowReads.isFetching,
    isError: warbowReads.isError,
    isSuccess: warbowReads.isSuccess,
    error: warbowReads.error,
  });

  const coreMapped = mapArenaV2AdvancedCoreRows(
    coreReads.data as readonly { status: string; result?: unknown }[] | undefined,
  );
  const warbowMapped = mapArenaV2AdvancedWarbowRows(
    warbowReads.data as readonly { status: string; result?: unknown }[] | undefined,
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
    if (!coreMapped || coreMapped.length <= PROTOCOL_READING_INDICES.doub) {
      return;
    }
    const doubRow = coreMapped[PROTOCOL_READING_INDICES.doub];
    if (!latchedAccepted && doubRow?.status === "success" && isNonZeroAddr(doubRow.result)) {
      setLatchedAccepted(doubRow.result as HexAddress);
    }
  }, [coreMapped, latchedAccepted]);

  const userSaleContracts =
    tc && address
      ? [
          { address: tc, abi: timeArenaReadAbi, functionName: "battlePoints" as const, args: [address] },
          { address: tc, abi: timeArenaReadAbi, functionName: "warbowGuardUntil" as const, args: [address] },
          { address: tc, abi: timeArenaReadAbi, functionName: "nextBuyAllowedAt" as const, args: [address] },
        ]
      : [];

  const { data: userSaleDataRaw } = useReadContracts({
    contracts: userSaleContracts as readonly unknown[],
    query: {
      enabled: Boolean(tc && address),
      refetchInterval: () => getRpcBackoffPollMs(1000),
      placeholderData: (previous) => previous,
    },
  });
  const userSaleData = userSaleDataRaw as readonly ContractReadRow[] | undefined;

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
    void coreReads.refetch();
    void warbowReads.refetch();
  }, [coreReads, warbowReads]);

  const value = useMemo(
    (): ArenaProtocolDataContextValue => ({
      arenaAddress: tc ?? undefined,
      protocolReading,
      refetchProtocolReads,
      latchedAcceptedAssetAddr: latchedAccepted,
      coreTcDataForAccordion,
      userSaleData,
      heroTimer,
      heroChainNowSec,
      refreshHeroTimer,
      refreshHeroTimerSoft: refreshHeroTimerSoft,
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

export function useArenaProtocolAccordionTokenDecimals() {
  const { latchedAcceptedAssetAddr: tokenAddr } = useArenaProtocolData();
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddr) },
  });
  return tokenDecimals !== undefined ? Number(tokenDecimals) : 18;
}

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
import {
  erc20Abi,
  feeRouterReadAbi,
  linearCharmPriceReadAbi,
  timeCurveReadAbi,
} from "@/lib/abis";
import { addresses, type HexAddress } from "@/lib/addresses";
import { useRpcQueryHealthForRefetch } from "@/hooks/useRpcQueryHealth";
import { getRpcBackoffPollMs } from "@/lib/rpcConnectivity";
import { mergeStickyMulticallRows, type MulticallReadRow } from "@/lib/mergeStickyMulticallRows";
import { useTimecurveHeroTimer } from "@/pages/timecurve/useTimecurveHeroTimer";
import type { ContractReadRow } from "@/lib/arenaPageHelpers";

const ZERO = "0x0000000000000000000000000000000000000000" as const;

/** Same order as the former `TimeCurveProtocolPage` TC bundle (indices 0–29). */
export const TIMECURVE_PROTOCOL_PAGE_TC_READS = [
  "saleStart",
  "deadline",
  "ended",
  "totalRaised",
  "totalCharmWeight",
  "totalTokensForSale",
  "currentMinBuyAmount",
  "currentMaxBuyAmount",
  "currentPricePerCharmWad",
  "initialMinBuy",
  "growthRateWad",
  "timerExtensionSec",
  "initialTimerSec",
  "timerCapSec",
  "buyCooldownSec",
  "REFERRAL_EACH_BPS",
  "feeRouter",
  "podiumPool",
  "charmPrice",
  "acceptedAsset",
  "launchedToken",
  "prizesDistributed",
  "warbowPendingFlagOwner",
  "warbowPendingFlagPlantAt",
  "WARBOW_FLAG_SILENCE_SEC",
  "WARBOW_FLAG_CLAIM_BP",
  "WARBOW_MAX_STEALS_PER_DAY",
  "WARBOW_STEAL_BURN_WAD",
  "WARBOW_GUARD_BURN_WAD",
  "WARBOW_REVENGE_WINDOW_SEC",
] as const;

/** Appended to the page bundle for RawDataAccordion + WarBow governance (indices 30–36). */
const TIMECURVE_PROTOCOL_EXTRA_TC_READS = [
  "currentCharmBoundsWad",
  "referralRegistry",
  "buyFeeRoutingEnabled",
  "timeCurveBuyRouter",
  "reservePodiumPayoutsEnabled",
  "warbowPodiumFinalized",
  "owner",
] as const;

const PROTOCOL_TC_ALL_READS = [
  ...TIMECURVE_PROTOCOL_PAGE_TC_READS,
  ...TIMECURVE_PROTOCOL_EXTRA_TC_READS,
] as const;

/** Indices into {@link PROTOCOL_TC_ALL_READS} / `protocolReading`. */
export const PROTOCOL_READING_INDICES = {
  feeRouter: 16,
  charmPrice: 18,
  acceptedAsset: 19,
  warbowPodiumFinalized: 35,
  owner: 36,
} as const;

function isNonZeroAddr(v: unknown): v is HexAddress {
  return typeof v === "string" && v.startsWith("0x") && v.length === 42 && v.toLowerCase() !== ZERO;
}

/**
 * Reorders the extended protocol multicall into the 27-row `coreTcContracts` shape used by
 * {@link useTimecurveProtocolRawAccordion} (matches former Arena raw accordion order).
 */
export function mapProtocolReadingToCoreTcData(
  reading: readonly ContractReadRow[] | undefined,
): readonly ContractReadRow[] | undefined {
  if (!reading || reading.length < PROTOCOL_TC_ALL_READS.length) {
    return undefined;
  }
  const g = (i: number) => reading[i];
  return [
    g(0), // saleStart
    g(1), // deadline
    g(3), // totalRaised
    g(2), // ended
    g(6), // currentMinBuyAmount
    g(7), // currentMaxBuyAmount
    g(30), // currentCharmBoundsWad
    g(8), // currentPricePerCharmWad
    g(18), // charmPrice
    g(19), // acceptedAsset
    g(31), // referralRegistry
    g(9), // initialMinBuy
    g(10), // growthRateWad
    g(11), // timerExtensionSec
    g(12), // initialTimerSec
    g(13), // timerCapSec
    g(5), // totalTokensForSale
    g(20), // launchedToken
    g(21), // prizesDistributed
    g(32), // buyFeeRoutingEnabled
    g(16), // feeRouter
    g(17), // podiumPool
    g(4), // totalCharmWeight
    g(14), // buyCooldownSec
    g(33), // timeCurveBuyRouter
    g(34), // reservePodiumPayoutsEnabled
    g(36), // owner
  ];
}

export type TimeCurveProtocolDataContextValue = {
  timeCurve: HexAddress | undefined;
  /** Merged sticky rows for the full extended TC multicall (length 37 when complete). */
  protocolReading: readonly ContractReadRow[];
  refetchProtocolReads: () => void;
  charmPriceRows: readonly ContractReadRow[];
  sinksRows: readonly ContractReadRow[];
  /** Latched routing addresses (set from first successful TC read; cleared on `timeCurve` change). */
  latchedCharmPriceAddr: HexAddress | undefined;
  latchedFeeRouterAddr: HexAddress | undefined;
  latchedAcceptedAssetAddr: HexAddress | undefined;
  coreTcDataForAccordion: readonly ContractReadRow[] | undefined;
  userSaleData: readonly ContractReadRow[] | undefined;
  heroTimer: ReturnType<typeof useTimecurveHeroTimer>["heroTimer"];
  heroChainNowSec: number | undefined;
  refreshHeroTimer: () => void;
  refreshHeroTimerSoft: () => void;
};

const TimeCurveProtocolDataContext = createContext<TimeCurveProtocolDataContextValue | null>(null);

export function TimeCurveProtocolDataProvider({ children }: { children: ReactNode }) {
  const tc = addresses.timeArena;
  const { address } = useAccount();

  const tcReadsStickyRef = useRef<readonly MulticallReadRow[]>([]);
  const charmReadsStickyRef = useRef<readonly MulticallReadRow[]>([]);
  const sinksReadsStickyRef = useRef<readonly MulticallReadRow[]>([]);

  const [latchedCharm, setLatchedCharm] = useState<HexAddress | undefined>(undefined);
  const [latchedFeeRouter, setLatchedFeeRouter] = useState<HexAddress | undefined>(undefined);
  const [latchedAccepted, setLatchedAccepted] = useState<HexAddress | undefined>(undefined);

  useEffect(() => {
    tcReadsStickyRef.current = [];
    charmReadsStickyRef.current = [];
    sinksReadsStickyRef.current = [];
    setLatchedCharm(undefined);
    setLatchedFeeRouter(undefined);
    setLatchedAccepted(undefined);
  }, [tc]);

  const protocolReads = useReadContracts({
    contracts: tc
      ? PROTOCOL_TC_ALL_READS.map((fn) => ({
          address: tc,
          abi: timeCurveReadAbi,
          functionName: fn,
        }))
      : [],
    query: {
      enabled: Boolean(tc),
      refetchInterval: () => getRpcBackoffPollMs(1000),
      placeholderData: (previous) => previous,
    },
  });

  useRpcQueryHealthForRefetch({
    isFetched: protocolReads.isFetched,
    isFetching: protocolReads.isFetching,
    isError: protocolReads.isError,
    isSuccess: protocolReads.isSuccess,
    error: protocolReads.error,
  });

  const readingLive = (protocolReads.data ?? []) as readonly ContractReadRow[];
  const protocolReading = useMemo(() => {
    const merged = mergeStickyMulticallRows(readingLive, tcReadsStickyRef.current);
    tcReadsStickyRef.current = merged;
    return merged as readonly ContractReadRow[];
  }, [readingLive]);

  useEffect(() => {
    if (protocolReading.length < PROTOCOL_TC_ALL_READS.length) {
      return;
    }
    const charmRow = protocolReading[PROTOCOL_READING_INDICES.charmPrice];
    if (!latchedCharm && charmRow?.status === "success" && isNonZeroAddr(charmRow.result)) {
      setLatchedCharm(charmRow.result as HexAddress);
    }
    const feeRow = protocolReading[PROTOCOL_READING_INDICES.feeRouter];
    if (!latchedFeeRouter && feeRow?.status === "success" && isNonZeroAddr(feeRow.result)) {
      setLatchedFeeRouter(feeRow.result as HexAddress);
    }
    const accRow = protocolReading[PROTOCOL_READING_INDICES.acceptedAsset];
    if (!latchedAccepted && accRow?.status === "success" && isNonZeroAddr(accRow.result)) {
      setLatchedAccepted(accRow.result as HexAddress);
    }
  }, [protocolReading, latchedCharm, latchedFeeRouter, latchedAccepted]);

  const charmPriceReads = useReadContracts({
    contracts: latchedCharm
      ? [
          {
            address: latchedCharm,
            abi: linearCharmPriceReadAbi,
            functionName: "basePriceWad",
          },
          {
            address: latchedCharm,
            abi: linearCharmPriceReadAbi,
            functionName: "dailyIncrementWad",
          },
        ]
      : [],
    query: {
      enabled: Boolean(latchedCharm),
      refetchInterval: () => getRpcBackoffPollMs(1000),
      placeholderData: (previous) => previous,
    },
  });

  useRpcQueryHealthForRefetch({
    isFetched: charmPriceReads.isFetched,
    isFetching: charmPriceReads.isFetching,
    isError: charmPriceReads.isError,
    isSuccess: charmPriceReads.isSuccess,
    error: charmPriceReads.error,
  });

  const FEE_SINK_COUNT = 5;
  const sinks = useReadContracts({
    contracts: latchedFeeRouter
      ? Array.from({ length: FEE_SINK_COUNT }, (_, i) => ({
          address: latchedFeeRouter,
          abi: feeRouterReadAbi,
          functionName: "sinks" as const,
          args: [BigInt(i)] as const,
        }))
      : [],
    query: {
      enabled: Boolean(latchedFeeRouter),
      refetchInterval: () => getRpcBackoffPollMs(1000),
      placeholderData: (previous) => previous,
    },
  });

  useRpcQueryHealthForRefetch({
    isFetched: sinks.isFetched,
    isFetching: sinks.isFetching,
    isError: sinks.isError,
    isSuccess: sinks.isSuccess,
    error: sinks.error,
  });

  const charmPriceRowsLive = (charmPriceReads.data ?? []) as readonly ContractReadRow[];
  const charmPriceRows = useMemo(() => {
    const merged = mergeStickyMulticallRows(charmPriceRowsLive, charmReadsStickyRef.current);
    charmReadsStickyRef.current = merged;
    return merged as readonly ContractReadRow[];
  }, [charmPriceRowsLive]);

  const sinksRowsLive = (sinks.data ?? []) as readonly ContractReadRow[];
  const sinksRows = useMemo(() => {
    const merged = mergeStickyMulticallRows(sinksRowsLive, sinksReadsStickyRef.current);
    sinksReadsStickyRef.current = merged;
    return merged as readonly ContractReadRow[];
  }, [sinksRowsLive]);

  const userSaleContracts =
    tc && address
      ? [
          { address: tc, abi: timeCurveReadAbi, functionName: "charmWeight" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "buyCount" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "charmsRedeemed" as const, args: [address] },
          {
            address: tc,
            abi: timeCurveReadAbi,
            functionName: "totalEffectiveTimerSecAdded" as const,
            args: [address],
          },
          { address: tc, abi: timeCurveReadAbi, functionName: "battlePoints" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "activeDefendedStreak" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "bestDefendedStreak" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "warbowGuardUntil" as const, args: [address] },
          { address: tc, abi: timeCurveReadAbi, functionName: "nextBuyAllowedAt" as const, args: [address] },
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
  } = useTimecurveHeroTimer(tc);

  const coreTcDataForAccordion = useMemo(
    () => mapProtocolReadingToCoreTcData(protocolReading),
    [protocolReading],
  );

  const refetchProtocolReads = useCallback(() => {
    void protocolReads.refetch();
    void charmPriceReads.refetch();
    void sinks.refetch();
  }, [protocolReads, charmPriceReads, sinks]);

  const value = useMemo(
    (): TimeCurveProtocolDataContextValue => ({
      timeCurve: tc ?? undefined,
      protocolReading,
      refetchProtocolReads,
      charmPriceRows,
      sinksRows,
      latchedCharmPriceAddr: latchedCharm,
      latchedFeeRouterAddr: latchedFeeRouter,
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
      charmPriceRows,
      sinksRows,
      latchedCharm,
      latchedFeeRouter,
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
    <TimeCurveProtocolDataContext.Provider value={value}>{children}</TimeCurveProtocolDataContext.Provider>
  );
}

export function useTimeCurveProtocolData(): TimeCurveProtocolDataContextValue {
  const ctx = useContext(TimeCurveProtocolDataContext);
  if (!ctx) {
    throw new Error("useTimeCurveProtocolData must be used within TimeCurveProtocolDataProvider");
  }
  return ctx;
}

/** Accordion-only: ERC20 decimals using latched accepted asset from protocol context. */
export function useTimecurveProtocolAccordionTokenDecimals() {
  const { latchedAcceptedAssetAddr: tokenAddr } = useTimeCurveProtocolData();
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddr) },
  });
  return tokenDecimals !== undefined ? Number(tokenDecimals) : 18;
}

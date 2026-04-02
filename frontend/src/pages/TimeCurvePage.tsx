// SPDX-License-Identifier: AGPL-3.0-only

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { maxUint256 } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { CharmRedemptionCurve } from "@/components/CharmRedemptionCurve";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { formatCompactFromRaw, rawToBigIntForFormat } from "@/lib/compactNumberFormat";
import { estimateGasUnits } from "@/lib/estimateContractGas";
import { TxHash } from "@/components/TxHash";
import {
  erc20Abi,
  feeRouterReadAbi,
  linearCharmPriceReadAbi,
  timeCurveReadAbi,
  timeCurveWriteAbi,
} from "@/lib/abis";
import { hashReferralCode, normalizeReferralCode } from "@/lib/referralCode";
import { clearPendingReferralCode, getPendingReferralCode } from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { sampleMinSpendCurve, WAD } from "@/lib/timeCurveMath";
import {
  RESERVE_FEE_ROUTING_BPS,
  kumbayaBandLowerWad,
  launchLiquidityAnchorWad,
  podiumCategorySlices,
  podiumPlacementShares,
  projectedReservePerDoubWad,
} from "@/lib/timeCurvePodiumMath";
import { wagmiConfig } from "@/wagmi-config";
import {
  fetchTimecurveCharmRedemptions,
  fetchTimecurveBuyerStats,
  fetchTimecurveBuys,
  fetchTimecurvePrizeDistributions,
  fetchTimecurvePrizePayouts,
  fetchReferralApplied,
  type CharmRedemptionItem,
  type BuyItem,
  type PrizeDistributionItem,
  type PrizePayoutItem,
  type ReferralAppliedItem,
  type TimecurveBuyerStats,
} from "@/lib/indexerApi";

const PODIUM_LABELS = [
  "Last buyers (50% of podium pool)",
  "Most buys (20%)",
  "Biggest single buy (10%)",
  "Highest cumulative CHARM (20%)",
];

export function TimeCurvePage() {
  const prefersReducedMotion = useReducedMotion();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const tc = addresses.timeCurve;
  const [buys, setBuys] = useState<BuyItem[] | null>(null);
  const [claims, setClaims] = useState<CharmRedemptionItem[] | null>(null);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);
  const [claimsNote, setClaimsNote] = useState<string | null>(null);
  const [charmCount, setCharmCount] = useState(5);
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  const [useReferral, setUseReferral] = useState(true);
  const [pendingRef, setPendingRef] = useState<string | null>(null);
  const [prizePayouts, setPrizePayouts] = useState<PrizePayoutItem[] | null>(null);
  const [prizeDist, setPrizeDist] = useState<PrizeDistributionItem[] | null>(null);
  const [refApplied, setRefApplied] = useState<ReferralAppliedItem[] | null>(null);
  const [buysNextOffset, setBuysNextOffset] = useState<number | null>(null);
  const [loadingMoreBuys, setLoadingMoreBuys] = useState(false);
  const [buyerStats, setBuyerStats] = useState<TimecurveBuyerStats | null>(null);
  const [gasBuy, setGasBuy] = useState<bigint | undefined>(undefined);
  const [gasClaim, setGasClaim] = useState<bigint | undefined>(undefined);
  const [gasDistribute, setGasDistribute] = useState<bigint | undefined>(undefined);

  const { writeContractAsync, isPending: isWriting } = useWriteContract();
  const primaryButtonMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.02, y: -2 },
        whileTap: { scale: 0.98, y: 1 },
      };
  const secondaryButtonMotion = prefersReducedMotion
    ? {}
    : {
        whileHover: { scale: 1.015, y: -2 },
        whileTap: { scale: 0.985, y: 1 },
      };

  useEffect(() => {
    setPendingRef(getPendingReferralCode());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchTimecurveBuys(25, 0);
      if (cancelled) {
        return;
      }
      if (!data) {
        setIndexerNote("Set VITE_INDEXER_URL to load recent buys from the indexer.");
        setBuys([]);
        setBuysNextOffset(null);
        return;
      }
      setBuys(data.items);
      setBuysNextOffset(data.next_offset);
      setIndexerNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const data = await fetchTimecurveCharmRedemptions(15);
      if (cancelled) {
        return;
      }
      if (!data) {
        setClaimsNote("Set VITE_INDEXER_URL to load charm redemptions.");
        setClaims([]);
        return;
      }
      setClaims(data.items);
      setClaimsNote(null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [pp, pd, ra] = await Promise.all([
        fetchTimecurvePrizePayouts(20),
        fetchTimecurvePrizeDistributions(10),
        fetchReferralApplied(address, 15),
      ]);
      if (cancelled) {
        return;
      }
      setPrizePayouts(pp?.items ?? null);
      setPrizeDist(pd?.items ?? null);
      setRefApplied(ra?.items ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  useEffect(() => {
    if (!address || !indexerBaseUrl()) {
      setBuyerStats(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const s = await fetchTimecurveBuyerStats(address);
      if (!cancelled) {
        setBuyerStats(s);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const { data, isPending, isError, refetch } = useReadContracts({
    contracts: tc
      ? [
          { address: tc, abi: timeCurveReadAbi, functionName: "saleStart" },
          { address: tc, abi: timeCurveReadAbi, functionName: "deadline" },
          { address: tc, abi: timeCurveReadAbi, functionName: "totalRaised" },
          { address: tc, abi: timeCurveReadAbi, functionName: "ended" },
          { address: tc, abi: timeCurveReadAbi, functionName: "currentMinBuyAmount" },
          { address: tc, abi: timeCurveReadAbi, functionName: "currentMaxBuyAmount" },
          { address: tc, abi: timeCurveReadAbi, functionName: "currentCharmBoundsWad" },
          { address: tc, abi: timeCurveReadAbi, functionName: "currentPricePerCharmWad" },
          { address: tc, abi: timeCurveReadAbi, functionName: "charmPrice" },
          { address: tc, abi: timeCurveReadAbi, functionName: "acceptedAsset" },
          { address: tc, abi: timeCurveReadAbi, functionName: "referralRegistry" },
          { address: tc, abi: timeCurveReadAbi, functionName: "initialMinBuy" },
          { address: tc, abi: timeCurveReadAbi, functionName: "growthRateWad" },
          { address: tc, abi: timeCurveReadAbi, functionName: "timerExtensionSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "initialTimerSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "timerCapSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "totalTokensForSale" },
          { address: tc, abi: timeCurveReadAbi, functionName: "launchedToken" },
          { address: tc, abi: timeCurveReadAbi, functionName: "prizesDistributed" },
          { address: tc, abi: timeCurveReadAbi, functionName: "feeRouter" },
          { address: tc, abi: timeCurveReadAbi, functionName: "podiumPool" },
          { address: tc, abi: timeCurveReadAbi, functionName: "totalCharmWeight" },
        ]
      : [],
    query: { enabled: Boolean(tc) },
  });

  const {
    data: userSaleData,
    refetch: refetchUserSale,
  } = useReadContracts({
    contracts:
      tc && address
        ? [
            { address: tc, abi: timeCurveReadAbi, functionName: "charmWeight", args: [address] },
            { address: tc, abi: timeCurveReadAbi, functionName: "buyCount", args: [address] },
            { address: tc, abi: timeCurveReadAbi, functionName: "charmsRedeemed", args: [address] },
            { address: tc, abi: timeCurveReadAbi, functionName: "biggestSingleBuy", args: [address] },
          ]
        : [],
    query: { enabled: Boolean(tc && address) },
  });

  const [
    saleStart,
    deadline,
    totalRaised,
    ended,
    minBuy,
    maxBuy,
    charmBoundsR,
    pricePerCharmR,
    charmPriceAddrR,
    acceptedAsset,
    refRegAddr,
    initialMinBuyR,
    growthRateWadR,
    timerExtensionSecR,
    initialTimerSecR,
    timerCapSecR,
    totalTokensForSaleR,
    launchedTokenR,
    prizesDistributedR,
    feeRouterR,
    podiumPoolR,
    totalCharmWeightR,
  ] = data ?? [];

  const [charmWeightR, buyCountR, charmsRedeemedR, biggestSingleBuyR] = userSaleData ?? [];

  const tokenAddr =
    acceptedAsset?.status === "success" ? (acceptedAsset.result as `0x${string}`) : undefined;

  const { data: tokenDecimals } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(tokenAddr) },
  });

  const decimals = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;

  const launchedAddr =
    launchedTokenR?.status === "success" ? (launchedTokenR.result as `0x${string}`) : undefined;

  const { data: launchedDecimals } = useReadContract({
    address: launchedAddr,
    abi: erc20Abi,
    functionName: "decimals",
    query: { enabled: Boolean(launchedAddr) },
  });

  const launchedDec = launchedDecimals !== undefined ? Number(launchedDecimals) : 18;

  const referralRegistryOn =
    refRegAddr?.status === "success" &&
    (refRegAddr.result as `0x${string}`) !== "0x0000000000000000000000000000000000000000";

  const feeRouterAddr =
    feeRouterR?.status === "success" ? (feeRouterR.result as `0x${string}`) : undefined;
  const podiumPoolAddr =
    podiumPoolR?.status === "success" ? (podiumPoolR.result as `0x${string}`) : undefined;

  const { data: sinkReads } = useReadContracts({
    contracts: feeRouterAddr
      ? ([0, 1, 2, 3, 4] as const).map((i) => ({
          address: feeRouterAddr,
          abi: feeRouterReadAbi,
          functionName: "sinks" as const,
          args: [BigInt(i)],
        }))
      : [],
    query: { enabled: Boolean(feeRouterAddr) },
  });

  const { data: podiumPoolBal } = useReadContract({
    address: tokenAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: podiumPoolAddr ? [podiumPoolAddr] : undefined,
    query: { enabled: Boolean(tokenAddr && podiumPoolAddr) },
  });

  const liquidityAnchors = useMemo(() => {
    if (totalRaised?.status !== "success" || totalTokensForSaleR?.status !== "success") {
      return null;
    }
    const tr = rawToBigIntForFormat(totalRaised.result as bigint);
    const tts = rawToBigIntForFormat(totalTokensForSaleR.result as bigint);
    const clearing = projectedReservePerDoubWad(tr, tts);
    if (clearing === null) {
      return null;
    }
    const launch = launchLiquidityAnchorWad(clearing);
    const kLo = kumbayaBandLowerWad(launch);
    return { clearing, launch, kLo };
  }, [totalRaised, totalTokensForSaleR]);

  const podiumPayoutPreview = useMemo(() => {
    const bal = typeof podiumPoolBal === "bigint" ? podiumPoolBal : 0n;
    const slices = podiumCategorySlices(bal);
    return slices.map((slice, cat) => {
      const [a, b, c] = podiumPlacementShares(slice);
      return { cat, slice, places: [a, b, c] as const };
    });
  }, [podiumPoolBal]);

  const podiumReads = usePodiumReads(tc);

  const linearCharmAddr =
    charmPriceAddrR?.status === "success" &&
    (charmPriceAddrR.result as `0x${string}`) !== "0x0000000000000000000000000000000000000000"
      ? (charmPriceAddrR.result as `0x${string}`)
      : undefined;

  const { data: linearPriceReads } = useReadContracts({
    contracts: linearCharmAddr
      ? [
          {
            address: linearCharmAddr,
            abi: linearCharmPriceReadAbi,
            functionName: "basePriceWad",
          },
          {
            address: linearCharmAddr,
            abi: linearCharmPriceReadAbi,
            functionName: "dailyIncrementWad",
          },
        ]
      : [],
    query: { enabled: Boolean(tc && linearCharmAddr) },
  });

  const [basePriceWadR, dailyIncWadR] = linearPriceReads ?? [];

  const saleActive =
    !isPending &&
    saleStart?.status === "success" &&
    (saleStart.result as bigint) > 0n &&
    ended?.status === "success" &&
    ended.result === false;

  const deadlineSec =
    deadline?.status === "success" ? Number(deadline.result as bigint) : undefined;
  const remaining =
    deadlineSec !== undefined ? Math.max(0, deadlineSec - now) : undefined;

  const maxBuyAmount =
    maxBuy?.status === "success" ? (maxBuy.result as bigint) : undefined;

  const minSpendCurvePoints = useMemo(() => {
    if (
      initialMinBuyR?.status !== "success" ||
      growthRateWadR?.status !== "success" ||
      saleStart?.status !== "success" ||
      basePriceWadR?.status !== "success" ||
      dailyIncWadR?.status !== "success"
    ) {
      return [];
    }
    const start = Number(saleStart.result as bigint);
    if (start <= 0) {
      return [];
    }
    const elapsed = BigInt(Math.max(0, now - start));
    if (elapsed === 0n) {
      return [];
    }
    return sampleMinSpendCurve(
      initialMinBuyR.result as bigint,
      growthRateWadR.result as bigint,
      basePriceWadR.result as bigint,
      dailyIncWadR.result as bigint,
      elapsed,
      40,
    );
  }, [initialMinBuyR, growthRateWadR, saleStart, now, basePriceWadR, dailyIncWadR]);

  const charmWadSelected = useMemo(() => BigInt(charmCount) * WAD, [charmCount]);

  const estimatedSpend = useMemo(() => {
    if (pricePerCharmR?.status !== "success") {
      return undefined;
    }
    const p = pricePerCharmR.result as bigint;
    return (charmWadSelected * p) / WAD;
  }, [charmWadSelected, pricePerCharmR]);

  const refetchAll = useCallback(() => {
    void refetch();
    void refetchUserSale();
    if (address && indexerBaseUrl()) {
      void fetchTimecurveBuyerStats(address).then(setBuyerStats);
    }
  }, [refetch, refetchUserSale, address]);

  const expectedTokenFromCharms = useMemo(() => {
    if (ended?.status !== "success" || !ended.result) {
      return undefined;
    }
    if (totalRaised?.status !== "success" || totalTokensForSaleR?.status !== "success") {
      return undefined;
    }
    if (charmWeightR?.status !== "success") {
      return undefined;
    }
    const tcw = totalCharmWeightR?.status === "success" ? (totalCharmWeightR.result as bigint) : 0n;
    if (tcw === 0n) {
      return undefined;
    }
    const us = charmWeightR.result as bigint;
    const tts = totalTokensForSaleR.result as bigint;
    return (tts * us) / tcw;
  }, [ended, totalCharmWeightR, totalTokensForSaleR, charmWeightR]);

  const indexerMismatch = useMemo(() => {
    if (!buyerStats || charmWeightR?.status !== "success" || buyCountR?.status !== "success") {
      return null;
    }
    let idxSpend: bigint;
    let idxCount: bigint;
    try {
      idxSpend = BigInt(buyerStats.indexed_charm_weight);
      idxCount = BigInt(buyerStats.indexed_buy_count);
    } catch {
      return "Could not parse indexer stats.";
    }
    const chainSpend = charmWeightR.result as bigint;
    const chainBuys = buyCountR.result as bigint;
    if (idxSpend !== chainSpend || idxCount !== chainBuys) {
      return "Indexer totals differ from onchain charmWeight / buyCount (lag, reorg, or indexing bug). Trust the contract for execution.";
    }
    return null;
  }, [buyerStats, charmWeightR, buyCountR]);

  const claimHint = useMemo(() => {
    if (ended?.status !== "success" || !ended.result) {
      return null;
    }
    if (charmWeightR?.status !== "success" || (charmWeightR.result as bigint) === 0n) {
      return "No charm weight.";
    }
    if (charmsRedeemedR?.status === "success" && charmsRedeemedR.result) {
      return "Already redeemed.";
    }
    if (expectedTokenFromCharms === undefined) {
      return undefined;
    }
    if (expectedTokenFromCharms === 0n) {
      return "Nothing to redeem at current totals (rounding).";
    }
    return null;
  }, [ended, charmWeightR, charmsRedeemedR, expectedTokenFromCharms]);

  const distributeHint = useMemo(() => {
    if (ended?.status !== "success" || !ended.result) {
      return "End the sale first.";
    }
    if (prizesDistributedR?.status === "success" && prizesDistributedR.result) {
      return "Prizes already marked distributed.";
    }
    return "May return without changing state if the podium pool balance is too small; retry after fees accrue.";
  }, [ended, prizesDistributedR]);

  useEffect(() => {
    if (!address || !tc || !saleActive) {
      setGasBuy(undefined);
      return;
    }
    const cw = BigInt(charmCount) * WAD;
    if (cw <= 0n) {
      setGasBuy(undefined);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        let codeHash: `0x${string}` | undefined;
        if (useReferral && referralRegistryOn && pendingRef) {
          try {
            codeHash = hashReferralCode(pendingRef);
          } catch {
            setGasBuy(undefined);
            return;
          }
        }
        const g = await estimateGasUnits({
          address: tc,
          abi: timeCurveWriteAbi,
          functionName: "buy",
          args: codeHash ? [cw, codeHash] : [cw],
          account: address,
          chainId,
        });
        setGasBuy(g);
      })();
    }, 400);
    return () => clearTimeout(t);
  }, [
    address,
    tc,
    saleActive,
    charmCount,
    useReferral,
    referralRegistryOn,
    pendingRef,
    chainId,
  ]);

  useEffect(() => {
    if (!address || !tc || ended?.status !== "success" || !ended.result) {
      setGasClaim(undefined);
      return;
    }
    void estimateGasUnits({
      address: tc,
      abi: timeCurveWriteAbi,
      functionName: "redeemCharms",
      account: address,
      chainId,
    }).then(setGasClaim);
  }, [address, tc, ended, chainId]);

  useEffect(() => {
    if (!address || !tc || ended?.status !== "success" || !ended.result) {
      setGasDistribute(undefined);
      return;
    }
    void estimateGasUnits({
      address: tc,
      abi: timeCurveWriteAbi,
      functionName: "distributePrizes",
      account: address,
      chainId,
    }).then(setGasDistribute);
  }, [address, tc, ended, chainId]);

  async function handleLoadMoreBuys() {
    if (buysNextOffset === null) {
      return;
    }
    setLoadingMoreBuys(true);
    const data = await fetchTimecurveBuys(25, buysNextOffset);
    setLoadingMoreBuys(false);
    if (!data) {
      return;
    }
    setBuys((prev) => (prev ? [...prev, ...data.items] : data.items));
    setBuysNextOffset(data.next_offset);
  }

  const handleBuy = useCallback(async () => {
    setBuyErr(null);
    if (!address || !tc || !tokenAddr) {
      setBuyErr("Connect a wallet and ensure contract reads succeeded.");
      return;
    }
    const cw = BigInt(charmCount) * WAD;
    if (charmBoundsR?.status !== "success") {
      setBuyErr("Waiting for onchain CHARM bounds.");
      return;
    }
    const [minC, maxC] = charmBoundsR.result as readonly [bigint, bigint];
    if (cw < minC || cw > maxC) {
      setBuyErr(
        "Selected charm count is outside the onchain band for this moment (envelope moved). Refresh reads or pick another size.",
      );
      return;
    }
    const amount = estimatedSpend;
    if (amount === undefined || amount <= 0n) {
      setBuyErr("Could not compute spend from onchain price; wait for contract reads.");
      return;
    }

    let codeHash: `0x${string}` | undefined;
    if (useReferral && referralRegistryOn && pendingRef) {
      try {
        codeHash = hashReferralCode(pendingRef);
      } catch (e) {
        setBuyErr(e instanceof Error ? e.message : String(e));
        return;
      }
    }

    try {
      const allow = await readContract(wagmiConfig, {
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, tc],
      });
      if (allow < amount) {
        const approveHash = await writeContractAsync({
          address: tokenAddr,
          abi: erc20Abi,
          functionName: "approve",
          args: [tc, maxUint256],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: approveHash });
      }
      if (codeHash) {
        const buyHash = await writeContractAsync({
          address: tc,
          abi: timeCurveWriteAbi,
          functionName: "buy",
          args: [cw, codeHash],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
        clearPendingReferralCode();
        setPendingRef(null);
      } else {
        const buyHash = await writeContractAsync({
          address: tc,
          abi: timeCurveWriteAbi,
          functionName: "buy",
          args: [cw],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
      }
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }, [
    address,
    tc,
    tokenAddr,
    charmCount,
    charmBoundsR,
    estimatedSpend,
    useReferral,
    referralRegistryOn,
    pendingRef,
    writeContractAsync,
    refetchAll,
  ]);

  async function runVoid(fn: "endSale" | "redeemCharms" | "distributePrizes") {
    setBuyErr(null);
    if (!tc) {
      return;
    }
    try {
      const hash = await writeContractAsync({
        address: tc,
        abi: timeCurveWriteAbi,
        functionName: fn,
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      refetchAll();
    } catch (e) {
      setBuyErr(friendlyRevertFromUnknown(e));
    }
  }

  if (!tc) {
    return (
      <section className="page page--timecurve">
        <h1>TimeCurve</h1>
        <div className="arcade-banner arcade-banner--with-sidekick">
          <img
            className="arcade-banner__coin"
            src="/art/token-logo.png"
            alt=""
            width={72}
            height={72}
            decoding="async"
          />
          <div className="arcade-banner__text">
            <p className="placeholder">
              Set <code>VITE_TIMECURVE_ADDRESS</code> in <code>.env</code> (see{" "}
              <code>.env.example</code>) to read onchain sale state.
            </p>
          </div>
          <CutoutDecoration
            className="arcade-banner__mascot cutout-decoration--sway"
            src="/art/cutouts/loading-mascot-circle.png"
            width={192}
            height={192}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="page page--timecurve">
      <h1>TimeCurve</h1>
      <div className="arcade-banner arcade-banner--with-sidekick">
        <img
          className="arcade-banner__coin"
          src="/art/token-logo.png"
          alt=""
          width={72}
          height={72}
          decoding="async"
        />
        <div className="arcade-banner__text">
          <p className="lede">
            Charms: earn weight by buying within the curve; after the sale, redeem for launched tokens.
            Live RPC + indexer feeds below.
          </p>
        </div>
        <CutoutDecoration
          className="arcade-banner__mascot cutout-decoration--float"
          src="/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png"
          width={220}
          height={220}
        />
      </div>

      <div className="data-panel">
        <h2>Onchain (contract)</h2>
        {isPending && (
          <div className="loading-state">
            <img
              src="/art/loading-mascot.png"
              alt=""
              width={96}
              height={96}
              decoding="async"
            />
            <p>Loading contract reads…</p>
          </div>
        )}
        {isError && <p className="error-text">Could not read contract (check RPC / network).</p>}
        {data && (
          <dl className="kv">
            <dt>saleStart</dt>
            <dd>
              {saleStart?.status === "success" ? (
                <UnixTimestampDisplay raw={saleStart.result as bigint} />
              ) : (
                "—"
              )}
            </dd>
            <dt>deadline</dt>
            <dd>
              {deadline?.status === "success" ? (
                <UnixTimestampDisplay raw={deadline.result as bigint} />
              ) : (
                "—"
              )}
            </dd>
            <dt>time remaining</dt>
            <dd>
              {remaining !== undefined ? `${remaining}s` : "—"}
            </dd>
            <dt>totalRaised</dt>
            <dd>
              {totalRaised?.status === "success" ? (
                <AmountDisplay raw={totalRaised.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>ended</dt>
            <dd>{ended?.status === "success" ? String(ended.result) : "—"}</dd>
            <dt>min gross spend (smallest CHARM tier × price)</dt>
            <dd>
              {minBuy?.status === "success" ? (
                <AmountDisplay raw={minBuy.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>price per 1e18 CHARM (WAD)</dt>
            <dd>
              {pricePerCharmR?.status === "success" ? (
                <AmountDisplay raw={pricePerCharmR.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>charmPrice (pricing module)</dt>
            <dd className="mono">
              {charmPriceAddrR?.status === "success" ? String(charmPriceAddrR.result) : "—"}
            </dd>
            <dt>referralRegistry</dt>
            <dd className="mono">
              {refRegAddr?.status === "success" ? String(refRegAddr.result) : "—"}
            </dd>
            <dt>launchedToken</dt>
            <dd className="mono">
              {launchedTokenR?.status === "success" ? String(launchedTokenR.result) : "—"}
            </dd>
            <dt>max buy (per tx)</dt>
            <dd>
              {maxBuyAmount !== undefined ? (
                <AmountDisplay raw={maxBuyAmount} decimals={decimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>prizesDistributed</dt>
            <dd>
              {prizesDistributedR?.status === "success" ? String(prizesDistributedR.result) : "—"}
            </dd>
          </dl>
        )}
      </div>

      <div className="data-panel">
        <h2>Charm redemption curve (implied average)</h2>
        <p className="muted">
          Implied average accepted asset per one launched token vs total charm weight in the sale
          (clears at sale end). The dot is today&apos;s pool; dashed line is your charm weight. This is
          not the per-tx charm price floor — see <strong>Min buy curve</strong> and <strong>Buy</strong>{" "}
          below.
        </p>
        {data && totalRaised?.status === "success" && totalTokensForSaleR?.status === "success" && (
          <CharmRedemptionCurve
            totalRaised={totalRaised.result as bigint}
            totalTokensForSale={totalTokensForSaleR.result as bigint}
            acceptedDecimals={decimals}
            launchedDecimals={launchedDec}
            userCharmWeight={
              charmWeightR?.status === "success" ? (charmWeightR.result as bigint) : undefined
            }
            saleStarted={saleStart?.status === "success" && (saleStart.result as bigint) > 0n}
          />
        )}
      </div>

      <div className="data-panel">
        <h2>Your participation</h2>
        {!isConnected && <p className="placeholder">Connect a wallet to see your onchain stats.</p>}
        {isConnected && address && (
          <>
            <dl className="kv">
              <dt>charmWeight</dt>
              <dd>
                {charmWeightR?.status === "success" ? (
                  <AmountDisplay raw={charmWeightR.result as bigint} decimals={18} />
                ) : (
                  "—"
                )}
              </dd>
              <dt>buyCount</dt>
              <dd>
                {buyCountR?.status === "success" ? String(buyCountR.result) : "—"}
              </dd>
              <dt>biggestSingleBuy</dt>
              <dd>
                {biggestSingleBuyR?.status === "success" ? (
                  <AmountDisplay raw={biggestSingleBuyR.result as bigint} decimals={decimals} />
                ) : (
                  "—"
                )}
              </dd>
              <dt>charmsRedeemed</dt>
              <dd>
                {charmsRedeemedR?.status === "success"
                  ? String(charmsRedeemedR.result)
                  : "—"}
              </dd>
              <dt>expected tokens from charms (if ended)</dt>
              <dd>
                {expectedTokenFromCharms !== undefined ? (
                  <AmountDisplay raw={expectedTokenFromCharms} decimals={18} />
                ) : (
                  "—"
                )}
              </dd>
            </dl>
            {indexerBaseUrl() && buyerStats && (
              <p className="muted">
                Indexer: charm weight {buyerStats.indexed_charm_weight} · buys{" "}
                {buyerStats.indexed_buy_count}
              </p>
            )}
            {indexerMismatch && <p className="error-text">{indexerMismatch}</p>}
            {claimHint && <p className="muted">{claimHint}</p>}
            {distributeHint && ended?.status === "success" && ended.result && (
              <p className="muted">{distributeHint}</p>
            )}
          </>
        )}
      </div>

      <div className="data-panel">
        <h2>Sale parameters (immutable)</h2>
        {data && (
          <dl className="kv">
            <dt>charm envelope ref WAD (exponential scaling)</dt>
            <dd>
              {initialMinBuyR?.status === "success" ? (
                <AmountDisplay raw={initialMinBuyR.result as bigint} decimals={18} />
              ) : (
                "—"
              )}
            </dd>
            <dt>growthRateWad</dt>
            <dd className="mono">
              {growthRateWadR?.status === "success"
                ? formatCompactFromRaw(growthRateWadR.result as bigint, 18)
                : "—"}
            </dd>
            <dt>timerExtensionSec</dt>
            <dd>
              {timerExtensionSecR?.status === "success" ? String(timerExtensionSecR.result) : "—"}
            </dd>
            <dt>initialTimerSec</dt>
            <dd>
              {initialTimerSecR?.status === "success" ? String(initialTimerSecR.result) : "—"}
            </dd>
            <dt>timerCapSec</dt>
            <dd>{timerCapSecR?.status === "success" ? String(timerCapSecR.result) : "—"}</dd>
            <dt>totalTokensForSale</dt>
            <dd>
              {totalTokensForSaleR?.status === "success" ? (
                <AmountDisplay raw={totalTokensForSaleR.result as bigint} decimals={18} />
              ) : (
                "—"
              )}
            </dd>
            <dt>feeRouter</dt>
            <dd className="mono">
              {feeRouterR?.status === "success" ? String(feeRouterR.result) : "—"}
            </dd>
            <dt>podiumPool</dt>
            <dd className="mono">
              {podiumPoolR?.status === "success" ? String(podiumPoolR.result) : "—"}
            </dd>
            <dt>totalCharmWeight</dt>
            <dd>
              {totalCharmWeightR?.status === "success" ? String(totalCharmWeightR.result) : "—"}
            </dd>
          </dl>
        )}
      </div>

      <div className="data-panel">
        <h2>Min gross spend curve (illustrative)</h2>
        <p className="muted">
          Minimum reserve spend for a buy (0.99 CHARM tier × linear price) vs time since sale start. The
          CHARM band scales with the <strong>exponential daily envelope</strong>; per-CHARM price follows the
          pluggable linear schedule. <strong>Authoritative values:</strong>{" "}
          <code>currentMinBuyAmount()</code> and <code>currentPricePerCharmWad()</code>.
        </p>
        {minSpendCurvePoints.length > 1 && (
          <svg className="epoch-chart" viewBox="0 0 400 120" role="img" aria-label="Min gross spend curve">
            {(() => {
              const vals = minSpendCurvePoints.map((p) => Number(p.minSpend));
              const vmin = Math.min(...vals);
              const vmax = Math.max(...vals);
              const span = Math.max(vmax - vmin, 1);
              return (
                <polyline
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="3"
                  points={minSpendCurvePoints
                    .map((p, i) => {
                      const x = (i / (minSpendCurvePoints.length - 1)) * 380 + 10;
                      const y = 110 - ((Number(p.minSpend) - vmin) / span) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              );
            })()}
          </svg>
        )}
        {minSpendCurvePoints.length <= 1 && <p className="muted">Curve appears after sale has started.</p>}
      </div>

      <div className="data-panel data-panel--spotlight">
        <CutoutDecoration
          className="panel-cutout panel-cutout--mid-right cutout-decoration--sway"
          src="/art/cutouts/cutout-bunnyleprechaungirl-head.png"
          width={196}
          height={196}
        />
        <h2>Buy charms (wallet)</h2>
        <p>
          Approves the accepted asset for <strong>TimeCurve</strong>, then calls{" "}
          <code>buy(charmWad)</code> or <code>buy(charmWad, codeHash)</code> where{" "}
          <code>charmWad</code> is whole charms × 1e18 (UI uses 1–10 only; onchain band is 0.99–10 CHARM scaled
          by the exponential envelope). Gross spend = <code>charmWad × price / 1e18</code> with linear
          per-CHARM pricing. Referral bonuses are extra CHARM weight (10% each side). Use a funded wallet on
          the configured chain.
        </p>
        {!isConnected && <p className="placeholder">Connect a wallet to buy.</p>}
        {isConnected && isPending && (
          <div className="loading-state">
            <img
              src="/art/loading-mascot.png"
              alt=""
              width={96}
              height={96}
              decoding="async"
            />
            <p>Loading contract…</p>
          </div>
        )}
        {isConnected && !saleActive && !isPending && (
          <p className="placeholder">Sale is not active (not started or already ended).</p>
        )}
        {isConnected && saleActive && (
          <>
            <label className="form-label">
              Charms (1–10, whole units; onchain CHARM = n × 1e18)
              <input
                type="range"
                className="form-input"
                min={1}
                max={10}
                step={1}
                value={charmCount}
                onChange={(e) => setCharmCount(Number(e.target.value))}
              />
              <span className="muted">
                {" "}
                {charmCount} charm{charmCount === 1 ? "" : "s"}
                {estimatedSpend !== undefined && (
                  <>
                    {" "}
                    → ~<AmountDisplay raw={estimatedSpend} decimals={decimals} /> spend
                  </>
                )}
              </span>
            </label>
            {referralRegistryOn && pendingRef && (
              <label className="form-label">
                <input
                  type="checkbox"
                  checked={useReferral}
                  onChange={(e) => setUseReferral(e.target.checked)}
                />{" "}
                Apply referral <code>{normalizeReferralCode(pendingRef)}</code> (from{" "}
                <code>?ref=</code>)
              </label>
            )}
            {referralRegistryOn && !pendingRef && (
              <p className="muted">Open a referral link with ?ref=CODE to enable referral CHARM bonuses.</p>
            )}
            <p>
              <motion.button
                type="button"
                className="btn-primary btn-primary--priority"
                disabled={isWriting}
                onClick={handleBuy}
                {...primaryButtonMotion}
              >
                {isWriting ? "Confirm in wallet…" : "Approve (if needed) & buy"}
              </motion.button>
            </p>
            {gasBuy !== undefined && (
              <p className="muted">Est. gas (buy): ~{gasBuy.toString()} units</p>
            )}
          </>
        )}
        {buyErr && <p className="error-text">{buyErr}</p>}
      </div>

      <div className="data-panel data-panel--spotlight">
        <CutoutDecoration
          className="panel-cutout panel-cutout--lower-right cutout-decoration--float"
          src="/art/cutouts/mascot-leprechaun-with-bag-cutout.png"
          width={228}
          height={228}
        />
        <h2>After sale</h2>
        <p>
          When the timer has expired: call <code>endSale</code> to finalize the sale, then{" "}
          <code>redeemCharms</code> to convert your charm weight into launched tokens, then{" "}
          <code>distributePrizes</code> to pay podium winners from the podium pool (reserve asset). Anyone may
          submit
          these transactions where the contract allows.
        </p>
        <div className="timecurve-action-row">
          <motion.button
            type="button"
            className="btn-secondary btn-secondary--critical"
            disabled={isWriting}
            onClick={() => runVoid("endSale")}
            {...secondaryButtonMotion}
          >
            endSale (timer expired)
          </motion.button>
          <motion.button
            type="button"
            className="btn-secondary btn-secondary--priority"
            disabled={isWriting}
            onClick={() => runVoid("redeemCharms")}
            {...secondaryButtonMotion}
          >
            redeemCharms
          </motion.button>
          <motion.button
            type="button"
            className="btn-secondary btn-secondary--priority"
            disabled={isWriting}
            onClick={() => runVoid("distributePrizes")}
            {...secondaryButtonMotion}
          >
            distributePrizes
          </motion.button>
        </div>
        {(gasClaim !== undefined || gasDistribute !== undefined) && (
          <p className="muted">
            {gasClaim !== undefined && <>Est. gas (claim): ~{gasClaim.toString()} units</>}
            {gasClaim !== undefined && gasDistribute !== undefined && <> · </>}
            {gasDistribute !== undefined && <>Est. gas (distribute): ~{gasDistribute.toString()} units</>}
          </p>
        )}
      </div>

      <div className="data-panel">
        <h2>Reserve routing (per buy)</h2>
        <p className="muted">
          Each buy routes the <strong>full gross</strong> amount in the accepted reserve asset through{" "}
          <code>FeeRouter</code>. Referral rewards are <strong>CHARM weight</strong> (not reserve transfers).
          Canonical shares: DOUB locked-liquidity (SIR / Kumbaya) 30% · CL8Y buy-and-burn 10% · podium pool 20%
          · team 5% · Rabbit Treasury 35%.
        </p>
        <ul className="event-list">
          {(
            [
              ["DOUB LP (locked SIR / Kumbaya)", RESERVE_FEE_ROUTING_BPS.doubLpLockedLiquidity],
              ["CL8Y buy-and-burn", RESERVE_FEE_ROUTING_BPS.cl8yBuyAndBurn],
              ["Podium pool", RESERVE_FEE_ROUTING_BPS.podiumPool],
              ["Team", RESERVE_FEE_ROUTING_BPS.team],
              ["Rabbit Treasury", RESERVE_FEE_ROUTING_BPS.rabbitTreasury],
            ] as const
          ).map(([label, bps], i) => {
            const row = sinkReads?.[i];
            const w =
              row?.status === "success" ? Number((row.result as readonly [unknown, number])[1]) : null;
            return (
              <li key={label}>
                <strong>{label}</strong> — policy {bps} bps
                {w !== null ? ` · onchain ${w} bps` : ""}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="data-panel">
        <h2>Clearing &amp; liquidity anchors (live projection)</h2>
        <p className="muted">
          <strong>Final reserve per DOUB</strong> (projection): reserve raised per wei of launched token
          allocated to the sale — <code>totalRaised × 1e18 / totalTokensForSale</code>.{" "}
          <strong>Launch liquidity anchor</strong> = that value × 1.2 (locked LP target for SIR / Kumbaya).{" "}
          <strong>Kumbaya v3 band lower</strong> = launch anchor × 0.8 (one-sided range to ∞ is configured
          offchain; DOUB depth depends on pool targets — excess genesis DOUB may be burned per launch policy).
        </p>
        {liquidityAnchors ? (
          <dl>
            <dt>Projected final reserve per 1 DOUB (WAD)</dt>
            <dd className="mono">{formatCompactFromRaw(liquidityAnchors.clearing, 18)}</dd>
            <dt>Launch liquidity anchor (×1.2, WAD)</dt>
            <dd className="mono">{formatCompactFromRaw(liquidityAnchors.launch, 18)}</dd>
            <dt>Kumbaya lower bound (0.8× launch, WAD)</dt>
            <dd className="mono">{formatCompactFromRaw(liquidityAnchors.kLo, 18)}</dd>
          </dl>
        ) : (
          <p className="muted">Waiting for sale totals…</p>
        )}
      </div>

      <div className="data-panel">
        <h2>Podium pool (live)</h2>
        <p className="muted">
          Balance in the accepted reserve asset held by <code>podiumPool</code>. Projected payouts use the
          onchain split: 50% / 20% / 10% / 20% across the four categories; within each category placements pay
          4∶2∶1 (1st is twice 2nd; 2nd twice 3rd). Integer rounding applies onchain.
        </p>
        <p>
          <strong>Current pool balance:</strong>{" "}
          {podiumPoolBal !== undefined ? (
            <AmountDisplay raw={podiumPoolBal as bigint} decimals={decimals} />
          ) : (
            "—"
          )}
        </p>
        <div className="podium-preview">
          {podiumPayoutPreview.map((row, idx) => (
            <div key={idx} className="podium-block">
              <h3>{PODIUM_LABELS[idx] ?? `Category ${idx}`}</h3>
              <ol className="podium-list">
                {(["1st", "2nd", "3rd"] as const).map((lab, j) => (
                  <li key={lab}>
                    {lab}: <AmountDisplay raw={row.places[j]} decimals={decimals} />
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div className="data-panel">
        <h2>Podiums (onchain)</h2>
        {podiumReads.isLoading && <p>Loading podiums…</p>}
        {podiumReads.data?.map((row, i) => (
          <div key={i} className="podium-block">
            <h3>{PODIUM_LABELS[i] ?? `Category ${i}`}</h3>
            <ol className="podium-list">
              {row.winners.map((w, j) => (
                <li key={j}>
                  <span className="mono">{w.slice(0, 10)}…</span> — value{" "}
                  {row.values[j] !== undefined
                    ? formatCompactFromRaw(row.values[j], decimals)
                    : "—"}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="data-panel">
        <h2>Recent buys (indexer)</h2>
        {indexerNote && <p className="placeholder">{indexerNote}</p>}
        {buys && buys.length === 0 && !indexerNote && <p>No buys indexed yet.</p>}
        {buys && buys.length > 0 && (
          <ul className="event-list">
            {buys.map((b) => (
              <li key={`${b.tx_hash}-${b.log_index}`}>
                <span className="mono">{b.buyer.slice(0, 10)}…</span> — amount{" "}
                <AmountDisplay raw={b.amount} decimals={decimals} /> — block {b.block_number} — tx{" "}
                <TxHash hash={b.tx_hash} />
              </li>
            ))}
          </ul>
        )}
        {buysNextOffset !== null && (
          <p>
            <button
              type="button"
              className="btn-secondary"
              disabled={loadingMoreBuys}
              onClick={() => void handleLoadMoreBuys()}
            >
              {loadingMoreBuys ? "Loading…" : "Load more"}
            </button>
          </p>
        )}
      </div>

      <div className="data-panel">
        <h2>Charm redemptions (indexer)</h2>
        {claimsNote && <p className="placeholder">{claimsNote}</p>}
        {claims && claims.length === 0 && !claimsNote && <p>No charm redemptions indexed yet.</p>}
        {claims && claims.length > 0 && (
          <ul className="event-list">
            {claims.map((c) => (
              <li key={`${c.tx_hash}-${c.log_index}`}>
                <span className="mono">{c.buyer.slice(0, 10)}…</span> — tokens{" "}
                <AmountDisplay raw={c.token_amount} decimals={18} /> — block {c.block_number} — tx{" "}
                <TxHash hash={c.tx_hash} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Podium batch runs (indexer)</h2>
        {prizeDist && prizeDist.length === 0 && <p>No prize batch runs indexed yet.</p>}
        {prizeDist && prizeDist.length > 0 && (
          <ul className="event-list">
            {prizeDist.map((p) => (
              <li key={`${p.tx_hash}-${p.log_index}`}>
                PrizesDistributed — block {p.block_number} — tx <TxHash hash={p.tx_hash} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Podium payouts (indexer)</h2>
        {prizePayouts && prizePayouts.length === 0 && <p>No PodiumPaid rows indexed yet.</p>}
        {prizePayouts && prizePayouts.length > 0 && (
          <ul className="event-list">
            {prizePayouts.map((p) => (
              <li key={`${p.tx_hash}-${p.log_index}`}>
                winner <span className="mono">{p.winner.slice(0, 10)}…</span> — cat {p.category} place{" "}
                {p.placement} — <AmountDisplay raw={BigInt(p.amount)} decimals={decimals} /> — tx{" "}
                <TxHash hash={p.tx_hash} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="data-panel">
        <h2>Referral buys (indexer, your wallet as referrer)</h2>
        {!address && <p className="placeholder">Connect a wallet.</p>}
        {address && refApplied && refApplied.length === 0 && <p>No rows indexed.</p>}
        {address && refApplied && refApplied.length > 0 && (
          <ul className="event-list">
            {refApplied.map((r) => (
              <li key={`${r.tx_hash}-${r.log_index}`}>
                buyer <span className="mono">{r.buyer.slice(0, 10)}…</span> — referrer CHARM added{" "}
                <AmountDisplay raw={BigInt(r.referrer_amount)} decimals={18} /> — block {r.block_number}{" "}
                — tx <TxHash hash={r.tx_hash} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function usePodiumReads(tc: `0x${string}` | undefined) {
  const cats = [0, 1, 2, 3] as const;
  const contracts = tc
    ? cats.map((c) => ({
        address: tc,
        abi: timeCurveReadAbi,
        functionName: "podium" as const,
        args: [c],
      }))
    : [];
  const { data, isPending } = useReadContracts({
    contracts,
    query: { enabled: Boolean(tc) },
  });

  const rows =
    data?.map((r) => {
      if (r.status !== "success") {
        return { winners: ["0x0", "0x0", "0x0"] as const, values: [0n, 0n, 0n] as const };
      }
      const result = r.result as readonly [
        readonly `0x${string}`[],
        readonly (bigint | string)[],
      ];
      const winners = result[0] as [`0x${string}`, `0x${string}`, `0x${string}`];
      const v = result[1];
      return {
        winners: [winners[0], winners[1], winners[2]],
        values: [
          rawToBigIntForFormat(v[0]),
          rawToBigIntForFormat(v[1]),
          rawToBigIntForFormat(v[2]),
        ] as const,
      };
    }) ?? [];

  return { data: rows, isLoading: isPending };
}

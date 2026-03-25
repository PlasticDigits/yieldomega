// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { readContract, waitForTransactionReceipt } from "wagmi/actions";
import { useAccount, useChainId, useReadContract, useReadContracts, useWriteContract } from "wagmi";
import { AmountDisplay } from "@/components/AmountDisplay";
import { CharmRedemptionCurve } from "@/components/CharmRedemptionCurve";
import { UnixTimestampDisplay } from "@/components/UnixTimestampDisplay";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { estimateGasUnits } from "@/lib/estimateContractGas";
import { TxHash } from "@/components/TxHash";
import { erc20Abi, timeCurveReadAbi, timeCurveWriteAbi } from "@/lib/abis";
import { hashReferralCode, normalizeReferralCode } from "@/lib/referralCode";
import { clearPendingReferralCode, getPendingReferralCode } from "@/lib/referralStorage";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { sampleMinBuyCurve } from "@/lib/timeCurveMath";
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
  "Last buyers",
  "Most buys",
  "Biggest buy",
  "Opening window",
  "Closing window",
  "Highest cumulative charm weight",
];

export function TimeCurvePage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const tc = addresses.timeCurve;
  const [buys, setBuys] = useState<BuyItem[] | null>(null);
  const [claims, setClaims] = useState<CharmRedemptionItem[] | null>(null);
  const [indexerNote, setIndexerNote] = useState<string | null>(null);
  const [claimsNote, setClaimsNote] = useState<string | null>(null);
  const [buyStr, setBuyStr] = useState("");
  const [buyErr, setBuyErr] = useState<string | null>(null);
  const minBuyInitialized = useRef(false);
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
          { address: tc, abi: timeCurveReadAbi, functionName: "acceptedAsset" },
          { address: tc, abi: timeCurveReadAbi, functionName: "referralRegistry" },
          { address: tc, abi: timeCurveReadAbi, functionName: "initialMinBuy" },
          { address: tc, abi: timeCurveReadAbi, functionName: "growthRateWad" },
          { address: tc, abi: timeCurveReadAbi, functionName: "purchaseCapMultiple" },
          { address: tc, abi: timeCurveReadAbi, functionName: "timerExtensionSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "initialTimerSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "timerCapSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "totalTokensForSale" },
          { address: tc, abi: timeCurveReadAbi, functionName: "openingWindowSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "closingWindowSec" },
          { address: tc, abi: timeCurveReadAbi, functionName: "launchedToken" },
          { address: tc, abi: timeCurveReadAbi, functionName: "prizesDistributed" },
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
    acceptedAsset,
    refRegAddr,
    initialMinBuyR,
    growthRateWadR,
    purchaseCapMultipleR,
    timerExtensionSecR,
    initialTimerSecR,
    timerCapSecR,
    totalTokensForSaleR,
    openingWindowSecR,
    closingWindowSecR,
    launchedTokenR,
    prizesDistributedR,
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

  const podiumReads = usePodiumReads(tc);

  useEffect(() => {
    if (minBuy?.status !== "success" || minBuyInitialized.current) {
      return;
    }
    if (tokenAddr && tokenDecimals === undefined) {
      return;
    }
    const dec = tokenDecimals !== undefined ? Number(tokenDecimals) : 18;
    minBuyInitialized.current = true;
    setBuyStr(formatUnits(minBuy.result as bigint, dec));
  }, [minBuy, tokenAddr, tokenDecimals]);

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

  const maxBuyAmount = useMemo(() => {
    if (minBuy?.status !== "success" || purchaseCapMultipleR?.status !== "success") {
      return undefined;
    }
    return (minBuy.result as bigint) * (purchaseCapMultipleR.result as bigint);
  }, [minBuy, purchaseCapMultipleR]);

  const minBuyCurvePoints = useMemo(() => {
    if (
      initialMinBuyR?.status !== "success" ||
      growthRateWadR?.status !== "success" ||
      saleStart?.status !== "success"
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
    return sampleMinBuyCurve(
      initialMinBuyR.result as bigint,
      growthRateWadR.result as bigint,
      elapsed,
      40,
    );
  }, [initialMinBuyR, growthRateWadR, saleStart, now]);

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
    const tr = totalRaised.result as bigint;
    if (tr === 0n) {
      return undefined;
    }
    const us = charmWeightR.result as bigint;
    const tts = totalTokensForSaleR.result as bigint;
    return (tts * us) / tr;
  }, [ended, totalRaised, totalTokensForSaleR, charmWeightR]);

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
    return "May return without changing state if the prize vault balance is too small; retry after fees accrue.";
  }, [ended, prizesDistributedR]);

  useEffect(() => {
    if (!address || !tc || !saleActive) {
      setGasBuy(undefined);
      return;
    }
    let amount: bigint;
    try {
      amount = parseUnits(buyStr.trim() || "0", decimals);
    } catch {
      setGasBuy(undefined);
      return;
    }
    if (amount <= 0n) {
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
          args: codeHash ? [amount, codeHash] : [amount],
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
    buyStr,
    decimals,
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
    let amount: bigint;
    try {
      amount = parseUnits(buyStr.trim() || "0", decimals);
    } catch {
      setBuyErr(`Invalid amount (use a decimal number, ${decimals} decimals).`);
      return;
    }
    if (amount <= 0n) {
      setBuyErr("Amount must be positive.");
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
          args: [amount, codeHash],
        });
        await waitForTransactionReceipt(wagmiConfig, { hash: buyHash });
        clearPendingReferralCode();
        setPendingRef(null);
      } else {
        const buyHash = await writeContractAsync({
          address: tc,
          abi: timeCurveWriteAbi,
          functionName: "buy",
          args: [amount],
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
    buyStr,
    decimals,
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
      <section className="page">
        <h1>TimeCurve</h1>
        <p className="placeholder">
          Set <code>VITE_TIMECURVE_ADDRESS</code> in <code>.env</code> (see{" "}
          <code>.env.example</code>) to read onchain sale state.
        </p>
      </section>
    );
  }

  return (
    <section className="page">
      <h1>TimeCurve</h1>
      <p className="lede">
        Charms: earn weight by buying within the curve; after the sale, redeem for launched tokens.
        Live RPC + indexer feeds below.
      </p>

      <div className="data-panel">
        <h2>Onchain (contract)</h2>
        {isPending && <p>Loading contract reads…</p>}
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
            <dt>currentMinBuyAmount (charm price floor)</dt>
            <dd>
              {minBuy?.status === "success" ? (
                <AmountDisplay raw={minBuy.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )}
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
                  <AmountDisplay raw={charmWeightR.result as bigint} decimals={decimals} />
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
            <dt>initialMinBuy</dt>
            <dd>
              {initialMinBuyR?.status === "success" ? (
                <AmountDisplay raw={initialMinBuyR.result as bigint} decimals={decimals} />
              ) : (
                "—"
              )}
            </dd>
            <dt>growthRateWad</dt>
            <dd>
              {growthRateWadR?.status === "success" ? String(growthRateWadR.result) : "—"}
            </dd>
            <dt>purchaseCapMultiple</dt>
            <dd>
              {purchaseCapMultipleR?.status === "success"
                ? String(purchaseCapMultipleR.result)
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
            <dt>openingWindowSec</dt>
            <dd>
              {openingWindowSecR?.status === "success" ? String(openingWindowSecR.result) : "—"}
            </dd>
            <dt>closingWindowSec</dt>
            <dd>
              {closingWindowSecR?.status === "success" ? String(closingWindowSecR.result) : "—"}
            </dd>
          </dl>
        )}
      </div>

      <div className="data-panel">
        <h2>Min charm price curve (illustrative)</h2>
        <p className="muted">
          Theoretical minimum per-tx buy (charm price floor) vs time since sale start — same growth rule
          as onchain math. <strong>Authoritative value:</strong> <code>currentMinBuyAmount()</code> on the
          contract.
        </p>
        {minBuyCurvePoints.length > 1 && (
          <svg className="epoch-chart" viewBox="0 0 400 120" role="img" aria-label="Min charm price curve">
            {(() => {
              const vals = minBuyCurvePoints.map((p) => Number(p.minBuy));
              const vmin = Math.min(...vals);
              const vmax = Math.max(...vals);
              const span = Math.max(vmax - vmin, 1);
              return (
                <polyline
                  fill="none"
                  stroke="var(--line)"
                  strokeWidth="3"
                  points={minBuyCurvePoints
                    .map((p, i) => {
                      const x = (i / (minBuyCurvePoints.length - 1)) * 380 + 10;
                      const y = 110 - ((Number(p.minBuy) - vmin) / span) * 100;
                      return `${x},${y}`;
                    })
                    .join(" ")}
                />
              );
            })()}
          </svg>
        )}
        {minBuyCurvePoints.length <= 1 && <p className="muted">Curve appears after sale has started.</p>}
      </div>

      <div className="data-panel">
        <h2>Buy charms (wallet)</h2>
        <p>
          Approves the accepted asset for <strong>TimeCurve</strong>, then calls{" "}
          <code>buy(amount)</code> or <code>buy(amount, codeHash)</code> to add charm weight. Referral
          codes split a portion off the gross spend. Use a funded wallet on the configured chain.
        </p>
        {!isConnected && <p className="placeholder">Connect a wallet to buy.</p>}
        {isConnected && isPending && <p className="placeholder">Loading contract…</p>}
        {isConnected && !saleActive && !isPending && (
          <p className="placeholder">Sale is not active (not started or already ended).</p>
        )}
        {isConnected && saleActive && (
          <>
            <label className="form-label">
              Amount (token units, {decimals} decimals)
              <input
                type="text"
                className="form-input"
                value={buyStr}
                onChange={(e) => setBuyStr(e.target.value)}
                spellCheck={false}
              />
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
              <p className="muted">Open a referral link with ?ref=CODE to enable referral bonuses.</p>
            )}
            <p>
              <button type="button" className="btn-primary" disabled={isWriting} onClick={handleBuy}>
                {isWriting ? "Confirm in wallet…" : "Approve (if needed) & buy"}
              </button>
            </p>
            {gasBuy !== undefined && (
              <p className="muted">Est. gas (buy): ~{gasBuy.toString()} units</p>
            )}
          </>
        )}
        {buyErr && <p className="error-text">{buyErr}</p>}
      </div>

      <div className="data-panel">
        <h2>After sale</h2>
        <p>
          When the timer has expired: call <code>endSale</code> to finalize the sale, then{" "}
          <code>redeemCharms</code> to convert your charm weight into launched tokens, then{" "}
          <code>distributePrizes</code> to pay prize winners from the prize vault. Anyone may submit
          these transactions where the contract allows.
        </p>
        <p>
          <button type="button" className="btn-secondary" disabled={isWriting} onClick={() => runVoid("endSale")}>
            endSale (timer expired)
          </button>{" "}
          <button
            type="button"
            className="btn-secondary"
            disabled={isWriting}
            onClick={() => runVoid("redeemCharms")}
          >
            redeemCharms
          </button>{" "}
          <button
            type="button"
            className="btn-secondary"
            disabled={isWriting}
            onClick={() => runVoid("distributePrizes")}
          >
            distributePrizes
          </button>
        </p>
        {(gasClaim !== undefined || gasDistribute !== undefined) && (
          <p className="muted">
            {gasClaim !== undefined && <>Est. gas (claim): ~{gasClaim.toString()} units</>}
            {gasClaim !== undefined && gasDistribute !== undefined && <> · </>}
            {gasDistribute !== undefined && <>Est. gas (distribute): ~{gasDistribute.toString()} units</>}
          </p>
        )}
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
                  {row.values[j]?.toString() ?? "—"}
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
        <h2>Prize distributions (indexer)</h2>
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
        <h2>Prize payouts (indexer)</h2>
        {prizePayouts && prizePayouts.length === 0 && <p>No PrizePaid rows indexed yet.</p>}
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
                buyer <span className="mono">{r.buyer.slice(0, 10)}…</span> — referrer reward{" "}
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
  const cats = [0, 1, 2, 3, 4, 5] as const;
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
      const result = r.result as readonly [readonly `0x${string}`[], readonly bigint[]];
      const winners = result[0] as [`0x${string}`, `0x${string}`, `0x${string}`];
      const values = result[1] as [bigint, bigint, bigint];
      return {
        winners: [winners[0], winners[1], winners[2]],
        values: [values[0], values[1], values[2]],
      };
    }) ?? [];

  return { data: rows, isLoading: isPending };
}

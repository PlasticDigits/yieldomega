// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useConfig, useReadContract } from "wagmi";
import { erc20Abi, timeArenaReadAbi, timeArenaWriteAbi } from "@/lib/abis";
import { addresses, indexerBaseUrl, type HexAddress } from "@/lib/addresses";
import { ensureDoubTimeArenaAllowance } from "@/lib/ensureDoubTimeArenaAllowance";
import { fetchArenaPodiumPoolDonations, type ArenaPodiumPoolDonations } from "@/lib/indexerApi";
import { getIndexerBackoffPollMs, reportIndexerFetchAttempt } from "@/lib/indexerConnectivity";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";
import {
  asWriteContractAsyncFn,
  writeContractWithGasBuffer,
} from "@/lib/writeContractWithGasBuffer";
import { useWriteContract } from "wagmi";

const RECENT_LIMIT = 10;

export function useArenaProtocolDonatePools() {
  const timeArena = addresses.timeArena;
  const wagmiConfig = useConfig();
  const { address, isConnected, chainId } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [data, setData] = useState<ArenaPodiumPoolDonations | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [indexerErr, setIndexerErr] = useState<string | null>(null);

  const [amountInput, setAmountInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [writeErr, setWriteErr] = useState<string | null>(null);
  const [writeOk, setWriteOk] = useState<string | null>(null);

  const doubTokenQ = useReadContract({
    address: timeArena,
    abi: timeArenaReadAbi,
    functionName: "doub",
    query: { enabled: Boolean(timeArena) },
  });

  const doubAddress =
    doubTokenQ.data && doubTokenQ.data !== "0x0000000000000000000000000000000000000000"
      ? (doubTokenQ.data as HexAddress)
      : undefined;

  const balanceQ = useReadContract({
    address: doubAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(doubAddress && address) },
  });

  const loadIndexer = useCallback(async () => {
    setRefreshing(true);
    setIndexerErr(null);
    try {
      const page = await fetchArenaPodiumPoolDonations(
        RECENT_LIMIT,
        isConnected && address ? address : undefined,
      );
      if (indexerBaseUrl()) {
        reportIndexerFetchAttempt(page != null);
      }
      if (!page) {
        setData(null);
        setIndexerErr(
          indexerBaseUrl()
            ? "Donation history is unavailable right now."
            : "Set VITE_INDEXER_URL to load donation totals from the indexer.",
        );
        return;
      }
      setData(page);
    } catch {
      setData(null);
      setIndexerErr("Could not load donation history.");
    } finally {
      setRefreshing(false);
      setInitialLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId = 0;

    const loop = async () => {
      if (cancelled) {
        return;
      }
      await loadIndexer();
      if (!cancelled && indexerBaseUrl()) {
        timeoutId = window.setTimeout(loop, getIndexerBackoffPollMs(5000));
      }
    };

    void loop();
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [loadIndexer]);

  const parsedAmountWei = (() => {
    const t = amountInput.trim();
    if (!t) {
      return null;
    }
    try {
      return parseUnits(t, 18);
    } catch {
      return null;
    }
  })();

  const donate = useCallback(async () => {
    if (!timeArena || !doubAddress || !address || chainId == null) {
      return;
    }
    if (parsedAmountWei == null || parsedAmountWei <= 0n) {
      setWriteErr("Enter a valid DOUB amount.");
      return;
    }
    const balance =
      balanceQ.data != null && typeof balanceQ.data === "bigint" ? balanceQ.data : 0n;
    if (balance < parsedAmountWei) {
      setWriteErr("Insufficient DOUB balance.");
      return;
    }

    setSubmitting(true);
    setWriteErr(null);
    setWriteOk(null);
    try {
      await ensureDoubTimeArenaAllowance({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address,
        chainId,
        doubAddress,
        timeArenaAddress: timeArena,
        needWei: parsedAmountWei,
      });
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address,
        chainId,
        address: timeArena,
        abi: timeArenaWriteAbi,
        functionName: "topUpPodiumPools",
        args: [parsedAmountWei],
      });
      await waitForWriteReceipt(wagmiConfig, { hash });
      setWriteOk("Donation confirmed onchain.");
      setAmountInput("");
      await loadIndexer();
      await balanceQ.refetch();
    } catch (e) {
      setWriteErr(friendlyRevertFromUnknown(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    address,
    balanceQ,
    chainId,
    doubAddress,
    loadIndexer,
    parsedAmountWei,
    timeArena,
    wagmiConfig,
    writeContractAsync,
  ]);

  return {
    timeArena,
    doubAddress,
    data,
    initialLoading,
    refreshing,
    indexerErr,
    loadIndexer,
    amountInput,
    setAmountInput,
    parsedAmountWei,
    doubBalanceWei: balanceQ.data,
    submitting,
    writeErr,
    writeOk,
    donate,
    isConnected,
    walletAddress: address,
  };
}

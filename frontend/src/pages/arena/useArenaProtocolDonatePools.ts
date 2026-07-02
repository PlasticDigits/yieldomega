// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useEffect, useState } from "react";
import { parseUnits } from "viem";
import { useAccount, useConfig } from "wagmi";
import { readContract } from "wagmi/actions";
import { erc20Abi, timeArenaWriteAbi } from "@/lib/abis";
import { addresses, indexerBaseUrl, type HexAddress } from "@/lib/addresses";
import { readArenaDoubUnlimitedApproval } from "@/lib/arenaDoubApprovalPreference";
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

/**
 * Donate-pools sponsorship on AUDIT — indexer for history; wallet RPC only at submit ([#301](https://gitlab.com/PlasticDigits/yieldomega/-/issues/301)).
 */
export function useArenaProtocolDonatePools(doubAddress: HexAddress | undefined) {
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
  const [doubBalanceWei, setDoubBalanceWei] = useState<bigint | undefined>(undefined);

  useEffect(() => {
    if (!doubAddress || !address || !isConnected) {
      setDoubBalanceWei(undefined);
      return;
    }
    let cancelled = false;
    void readContract(wagmiConfig, {
      address: doubAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
      chainId,
    })
      .then((balance: bigint) => {
        if (!cancelled) {
          setDoubBalanceWei(balance);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDoubBalanceWei(undefined);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [address, chainId, doubAddress, isConnected, wagmiConfig]);

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

  const refreshDoubBalance = useCallback(async (): Promise<bigint | undefined> => {
    if (!doubAddress || !address || chainId == null) {
      return undefined;
    }
    const balance = await readContract(wagmiConfig, {
      address: doubAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address],
      chainId,
    });
    setDoubBalanceWei(balance);
    return balance;
  }, [address, chainId, doubAddress, wagmiConfig]);

  const donate = useCallback(async () => {
    if (!timeArena || !doubAddress || !address || chainId == null) {
      return;
    }
    if (parsedAmountWei == null || parsedAmountWei <= 0n) {
      setWriteErr("Enter a valid DOUB amount.");
      return;
    }
    const balance = (await refreshDoubBalance()) ?? doubBalanceWei ?? 0n;
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
        unlimitedPreferred: readArenaDoubUnlimitedApproval(),
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
      await refreshDoubBalance();
    } catch (e) {
      setWriteErr(friendlyRevertFromUnknown(e));
    } finally {
      setSubmitting(false);
    }
  }, [
    address,
    chainId,
    doubAddress,
    doubBalanceWei,
    loadIndexer,
    parsedAmountWei,
    refreshDoubBalance,
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
    doubBalanceWei,
    submitting,
    writeErr,
    writeOk,
    donate,
    isConnected,
    walletAddress: address,
  };
}

// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import type { ContractFunctionParameters } from "viem";
import { useBalance, useChainId, useReadContracts } from "wagmi";
import { erc20Abi, timeArenaReadAbi } from "@/lib/abis";
import { parseHexAddress, timeArenaAddress, type HexAddress } from "@/lib/addresses";
import { resolveKumbayaRouting } from "@/lib/kumbayaRoutes";

const ZERO = "0x0000000000000000000000000000000000000000" as HexAddress;

function hexFromRead(r: unknown): HexAddress | undefined {
  return parseHexAddress(typeof r === "string" ? r : undefined);
}

function readBigint(row: { status: string; result?: unknown } | undefined): bigint | undefined {
  if (row?.status !== "success") return undefined;
  return row.result as bigint;
}

export type WalletProfileBalancesSnapshot = {
  charmWad: bigint | undefined;
  credWei: bigint | undefined;
  doubWei: bigint | undefined;
  ethWei: bigint | undefined;
  usdmWei: bigint | undefined;
  showUsdm: boolean;
  isLoading: boolean;
};

export function useWalletProfileBalances(address: string | undefined): WalletProfileBalancesSnapshot {
  const wallet = parseHexAddress(address);
  const tc = timeArenaAddress();
  const chainId = useChainId();
  const kumbaya = resolveKumbayaRouting(chainId, import.meta.env);
  const usdmAddr =
    kumbaya.ok && kumbaya.config.usdm !== ZERO ? kumbaya.config.usdm : undefined;

  const metaEnabled = Boolean(wallet && tc);
  const { data: metaRows, isPending: metaPending } = useReadContracts({
    contracts: metaEnabled
      ? ([
          { address: tc!, abi: timeArenaReadAbi, functionName: "doub" as const },
          { address: tc!, abi: timeArenaReadAbi, functionName: "playCred" as const },
          { address: tc!, abi: timeArenaReadAbi, functionName: "lastBuyEpoch" as const },
        ] as const)
      : [],
    query: { enabled: metaEnabled },
  });

  const doubAddr = useMemo(() => hexFromRead(metaRows?.[0]?.result), [metaRows]);
  const playCredAddr = useMemo(() => {
    const a = hexFromRead(metaRows?.[1]?.result);
    return a && a !== ZERO ? a : undefined;
  }, [metaRows]);
  const lastBuyEpoch = readBigint(metaRows?.[2]);

  const balanceContracts = useMemo((): ContractFunctionParameters[] => {
    if (!wallet) return [];
    const c: ContractFunctionParameters[] = [];
    if (doubAddr) {
      c.push({ address: doubAddr, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
    }
    if (playCredAddr) {
      c.push({ address: playCredAddr, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
    }
    if (usdmAddr) {
      c.push({ address: usdmAddr, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
    }
    if (tc && lastBuyEpoch !== undefined) {
      c.push({
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "epochCharmWad",
        args: [lastBuyEpoch, wallet],
      });
    }
    return c;
  }, [wallet, doubAddr, playCredAddr, usdmAddr, tc, lastBuyEpoch]);

  const balancesEnabled = Boolean(wallet && metaRows && balanceContracts.length > 0);
  const { data: balanceRows, isPending: balancesPending } = useReadContracts({
    contracts: balanceContracts,
    query: { enabled: balancesEnabled },
  });

  const { data: ethBal, isPending: ethPending } = useBalance({
    address: wallet,
    query: { enabled: Boolean(wallet) },
  });

  const tokenBalances = useMemo(() => {
    let i = 0;
    let doubWei: bigint | undefined;
    let credWei: bigint | undefined;
    let usdmWei: bigint | undefined;
    let charmWad: bigint | undefined;
    if (!balanceRows) {
      return { charmWad, credWei, doubWei, usdmWei };
    }
    if (doubAddr) doubWei = readBigint(balanceRows[i++]);
    if (playCredAddr) credWei = readBigint(balanceRows[i++]);
    if (usdmAddr) usdmWei = readBigint(balanceRows[i++]);
    if (tc && lastBuyEpoch !== undefined) charmWad = readBigint(balanceRows[i++]);
    return { charmWad, credWei, doubWei, usdmWei };
  }, [balanceRows, doubAddr, playCredAddr, usdmAddr, tc, lastBuyEpoch]);

  const isLoading =
    Boolean(wallet) &&
    (metaPending || balancesPending || ethPending || (metaEnabled && metaRows === undefined));

  return {
    ...tokenBalances,
    ethWei: ethBal?.value !== undefined ? BigInt(ethBal.value) : undefined,
    showUsdm: usdmAddr !== undefined,
    isLoading,
  };
}

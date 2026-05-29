// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";
import { erc20Abi, timeArenaReadAbi } from "@/lib/abis";
import type { HexAddress } from "@/lib/addresses";
import { credBurnForCharmWad, type ArenaCredBurnParams } from "@/lib/arenaCredBurn";

const ZERO = "0x0000000000000000000000000000000000000000" as HexAddress;

export type UseArenaPlayCredInput = {
  arenaAddress: HexAddress | undefined;
  charmWad: bigint | undefined;
  enabled?: boolean;
};

export function useArenaPlayCred({ arenaAddress, charmWad, enabled = true }: UseArenaPlayCredInput) {
  const { address: wallet } = useAccount();
  const on = Boolean(enabled && arenaAddress);

  const { data, refetch } = useReadContracts({
    contracts: on
      ? ([
          { address: arenaAddress!, abi: timeArenaReadAbi, functionName: "playCred" as const },
          { address: arenaAddress!, abi: timeArenaReadAbi, functionName: "CRED_BUY_BURN" as const },
        ] as const)
      : [],
    query: { enabled: on },
  });

  const playCredAddress = useMemo((): HexAddress | undefined => {
    const row = data?.[0];
    if (row?.status !== "success") return undefined;
    const addr = row.result as HexAddress;
    if (!addr || addr.toLowerCase() === ZERO) return undefined;
    return addr;
  }, [data]);

  const burnParams = useMemo((): ArenaCredBurnParams | undefined => {
    const burnRow = data?.[1];
    if (burnRow?.status !== "success") return undefined;
    return {
      credBuyBurn: burnRow.result as bigint,
      credPerCharmWad: 0n,
    };
  }, [data]);

  const { data: balanceData, refetch: refetchBalance } = useReadContracts({
    contracts:
      playCredAddress && wallet
        ? ([
            {
              address: playCredAddress,
              abi: erc20Abi,
              functionName: "balanceOf" as const,
              args: [wallet],
            },
          ] as const)
        : [],
    query: { enabled: Boolean(playCredAddress && wallet) },
  });

  const credBalanceWei = useMemo((): bigint | undefined => {
    const row = balanceData?.[0];
    if (row?.status !== "success") return undefined;
    return row.result as bigint;
  }, [balanceData]);

  const requiredCredBurnWei = useMemo((): bigint | undefined => {
    if (burnParams === undefined || charmWad === undefined || charmWad <= 0n) {
      return undefined;
    }
    return credBurnForCharmWad(charmWad, burnParams);
  }, [burnParams, charmWad]);

  const refetchCred = () => {
    void refetch();
    void refetchBalance();
  };

  return {
    playCredAddress,
    playCredConfigured: playCredAddress !== undefined,
    burnParams,
    credBalanceWei,
    requiredCredBurnWei,
    refetchCred,
  };
}

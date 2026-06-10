// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState } from "react";
import { useAccount, useBlock, useChainId, useConfig, useReadContract, useWriteContract } from "wagmi";
import { isAddress } from "viem";
import { addresses, indexerBaseUrl } from "@/lib/addresses";
import { timeArenaReadAbi, timeArenaWriteAbi } from "@/lib/abis";
import { readArenaDoubUnlimitedApproval } from "@/lib/arenaDoubApprovalPreference";
import { ensureDoubTimeArenaAllowance } from "@/lib/ensureDoubTimeArenaAllowance";
import { friendlyRevertFromUnknown } from "@/lib/revertMessage";
import { readFreshWarbowStealPreflight } from "@/lib/timeArenaWarbowStealSubmitPreflight";
import { describeStealPreflight } from "@/lib/timeArenaUx";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import {
  WARBOW_STEAL_VICTIM_EMPTY_ATTEMPT,
  WARBOW_STEAL_VICTIM_INVALID_ADDRESS,
  warbowStealVictimInputFormatError,
} from "@/lib/warbowStealVictimInput";
import { shortAddress } from "@/lib/addressFormat";
import { waitForWriteReceipt } from "@/lib/realtimeTransaction";
import {
  asWriteContractAsyncFn,
  writeContractWithGasBuffer,
} from "@/lib/writeContractWithGasBuffer";
import {
  WARBOW_GUARD_DOUB_WAD,
  WARBOW_MAX_STEALS_PER_DAY,
  WARBOW_REVENGE_DOUB_WAD,
  WARBOW_SECONDS_PER_DAY,
  WARBOW_STEAL_DOUB_WAD,
  WARBOW_STEAL_LIMIT_BYPASS_DOUB_WAD,
} from "@/lib/arenaWarbowConstants";
import type { SaleSessionPhase } from "@/pages/arena/arenaSimplePhase";

export type IndexerWarbowHeroHead = {
  chainNowSec?: number;
  paused?: boolean;
  guardUntilSec?: bigint;
};

export function useArenaWarbowHero(
  phase: SaleSessionPhase,
  opts?: {
    indexerViewerBattlePoints?: bigint;
    indexerWarbowHead?: IndexerWarbowHeroHead;
  },
) {
  const tc = addresses.timeArena;
  const wagmiConfig = useConfig();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const indexerOn = Boolean(indexerBaseUrl());
  const indexerWarbowHead = opts?.indexerWarbowHead;
  const { data: block } = useBlock({
    watch: true,
    query: { enabled: !indexerOn },
  });
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [stealVictimInput, setStealVictimInput] = useState("");
  const [stealBypass, setStealBypass] = useState(false);
  const [pvpErr, setPvpErr] = useState<string | null>(null);

  const saleActive = phase === "saleActive";
  const chainNowSecFromBlock =
    block?.timestamp !== undefined ? Number(block.timestamp) : undefined;
  const chainNowSec = indexerWarbowHead?.chainNowSec ?? chainNowSecFromBlock;
  const indexerViewerBattlePoints = opts?.indexerViewerBattlePoints;

  const readOpts = { address: tc, abi: timeArenaReadAbi, query: { enabled: Boolean(tc) } };
  const { data: doub } = useReadContract({ ...readOpts, functionName: "doub" });
  const { data: paused } = useReadContract({
    ...readOpts,
    functionName: "paused",
    query: { enabled: Boolean(tc) && !indexerOn },
  });
  const { data: stealDoub } = useReadContract({
    ...readOpts,
    functionName: "WARBOW_STEAL_DOUB",
    query: { enabled: Boolean(tc) && !indexerOn },
  });
  const { data: guardDoub } = useReadContract({
    ...readOpts,
    functionName: "WARBOW_GUARD_DOUB",
    query: { enabled: Boolean(tc) && !indexerOn },
  });
  const { data: bypassDoub } = useReadContract({
    ...readOpts,
    functionName: "WARBOW_STEAL_LIMIT_BYPASS_DOUB",
    query: { enabled: Boolean(tc) && !indexerOn },
  });
  const { data: revengeDoub } = useReadContract({
    ...readOpts,
    functionName: "WARBOW_REVENGE_DOUB",
    query: { enabled: Boolean(tc) && !indexerOn },
  });
  const { data: maxStealsRaw } = useReadContract({
    ...readOpts,
    functionName: "WARBOW_MAX_STEALS_PER_DAY",
    query: { enabled: Boolean(tc) && !indexerOn },
  });
  const { data: secsPerDay } = useReadContract({
    ...readOpts,
    functionName: "SECONDS_PER_DAY",
    query: { enabled: Boolean(tc) && !indexerOn },
  });
  const { data: viewerBp, refetch: refetchBp } = useReadContract({
    ...readOpts,
    functionName: "battlePoints",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(tc && address && !indexerOn) },
  });
  const viewerBattlePointsEffective = indexerViewerBattlePoints ?? viewerBp;
  const { data: guardUntil, refetch: refetchGuard } = useReadContract({
    ...readOpts,
    functionName: "warbowGuardUntil",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(tc && address && !indexerOn) },
  });
  const guardUntilEffective = indexerWarbowHead?.guardUntilSec ?? guardUntil;

  const stealDoubWei = indexerOn ? WARBOW_STEAL_DOUB_WAD : (stealDoub ?? WARBOW_STEAL_DOUB_WAD);
  const guardDoubWei = indexerOn ? WARBOW_GUARD_DOUB_WAD : (guardDoub ?? WARBOW_GUARD_DOUB_WAD);
  const bypassDoubWei = indexerOn
    ? WARBOW_STEAL_LIMIT_BYPASS_DOUB_WAD
    : (bypassDoub ?? WARBOW_STEAL_LIMIT_BYPASS_DOUB_WAD);
  const revengeDoubWei = indexerOn
    ? WARBOW_REVENGE_DOUB_WAD
    : (revengeDoub ?? WARBOW_REVENGE_DOUB_WAD);
  const maxSteals = indexerOn
    ? WARBOW_MAX_STEALS_PER_DAY
    : maxStealsRaw !== undefined
      ? Number(maxStealsRaw)
      : WARBOW_MAX_STEALS_PER_DAY;
  const daySec = indexerOn ? WARBOW_SECONDS_PER_DAY : (secsPerDay ?? WARBOW_SECONDS_PER_DAY);

  const utcDayId =
    chainNowSec !== undefined ? BigInt(Math.floor(chainNowSec / Number(daySec))) : 0n;

  const stealVictim = useMemo(() => {
    const t = stealVictimInput.trim();
    return isAddress(t) ? (t as `0x${string}`) : undefined;
  }, [stealVictimInput]);

  const stealVictimFormatError = warbowStealVictimInputFormatError(stealVictimInput);
  const wrongChain = chainMismatchWriteMessage(chainId) !== null;
  const writesPaused = indexerOn ? indexerWarbowHead?.paused === true : paused === true;
  const canPress = isConnected && saleActive && !writesPaused && !wrongChain && !isWriting;

  const guardedActive =
    chainNowSec !== undefined &&
    guardUntilEffective !== undefined &&
    guardUntilEffective > 0n
      ? BigInt(chainNowSec) < guardUntilEffective
      : false;

  const refetch = useCallback(async () => {
    await Promise.all([refetchBp(), refetchGuard()]);
  }, [refetchBp, refetchGuard]);

  const failIfWrongChain = useCallback(() => {
    const msg = chainMismatchWriteMessage(chainId);
    if (msg) {
      setPvpErr(msg);
      return true;
    }
    return false;
  }, [chainId]);

  const runWarBowSteal = useCallback(async () => {
    setPvpErr(null);
    if (failIfWrongChain()) return;
    if (writesPaused) {
      setPvpErr("Time Arena is paused — WarBow DOUB spend is disabled until operators unpause.");
      return;
    }
    if (!tc || !address || !doub) return;
    if (!stealVictim) {
      setPvpErr(
        stealVictimInput.trim().length > 0
          ? WARBOW_STEAL_VICTIM_INVALID_ADDRESS
          : WARBOW_STEAL_VICTIM_EMPTY_ATTEMPT,
      );
      return;
    }
    try {
      const fresh = await readFreshWarbowStealPreflight({ tc, victim: stealVictim, utcDayId });
      const victimGuarded =
        chainNowSec !== undefined && BigInt(chainNowSec) < fresh.victimGuardUntil;
      const preflight = describeStealPreflight(
        {
          connected: isConnected,
          saleActive,
          viewer: address,
          victim: stealVictim,
          viewerBattlePoints: viewerBattlePointsEffective,
          victimBattlePoints: fresh.victimBattlePoints,
          victimStealsToday: fresh.victimStealsToday,
          attackerStealsToday: undefined,
          maxStealsPerDay: BigInt(maxSteals),
          bypassSelected: stealBypass,
          guardActive: victimGuarded,
        },
        shortAddress,
      );
      if (preflight.tone === "error") {
        setPvpErr(preflight.detail ?? preflight.title);
        return;
      }
      const need = stealDoubWei + (stealBypass ? bypassDoubWei : 0n);
      await ensureDoubTimeArenaAllowance({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address,
        chainId,
        doubAddress: doub,
        timeArenaAddress: tc,
        needWei: need,
        unlimitedPreferred: readArenaDoubUnlimitedApproval(),
      });
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address,
        chainId,
        address: tc,
        abi: timeArenaWriteAbi,
        functionName: "warbowSteal",
        args: [stealVictim, stealBypass],
      });
      await waitForWriteReceipt(wagmiConfig, { hash });
      await refetch();
    } catch (e) {
      setPvpErr(friendlyRevertFromUnknown(e));
    }
  }, [
    failIfWrongChain,
    writesPaused,
    tc,
    address,
    doub,
    stealVictim,
    stealVictimInput,
    stealBypass,
    chainNowSec,
    isConnected,
    saleActive,
    viewerBattlePointsEffective,
    maxSteals,
    utcDayId,
    stealDoubWei,
    bypassDoubWei,
    wagmiConfig,
    writeContractAsync,
    chainId,
    refetch,
  ]);

  const runWarBowGuard = useCallback(async () => {
    setPvpErr(null);
    if (failIfWrongChain()) return;
    if (writesPaused) {
      setPvpErr("Time Arena is paused — WarBow DOUB spend is disabled until operators unpause.");
      return;
    }
    if (!tc || !address || !doub) return;
    try {
      await ensureDoubTimeArenaAllowance({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address,
        chainId,
        doubAddress: doub,
        timeArenaAddress: tc,
        needWei: guardDoubWei,
        unlimitedPreferred: readArenaDoubUnlimitedApproval(),
      });
      const { hash } = await writeContractWithGasBuffer({
        wagmiConfig,
        writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
        account: address,
        chainId,
        address: tc,
        abi: timeArenaWriteAbi,
        functionName: "warbowActivateGuard",
      });
      await waitForWriteReceipt(wagmiConfig, { hash });
      await refetch();
    } catch (e) {
      setPvpErr(friendlyRevertFromUnknown(e));
    }
  }, [
    failIfWrongChain,
    writesPaused,
    tc,
    address,
    doub,
    guardDoubWei,
    wagmiConfig,
    writeContractAsync,
    chainId,
    refetch,
  ]);

  const runWarBowRevenge = useCallback(
    async (stealer: `0x${string}`) => {
      setPvpErr(null);
      if (failIfWrongChain()) return;
      if (writesPaused) {
        setPvpErr("Time Arena is paused — WarBow DOUB spend is disabled until operators unpause.");
        return;
      }
      if (!tc || !address || !doub) return;
      try {
        await ensureDoubTimeArenaAllowance({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address,
          chainId,
          doubAddress: doub,
          timeArenaAddress: tc,
          needWei: revengeDoubWei,
          unlimitedPreferred: readArenaDoubUnlimitedApproval(),
        });
        const { hash } = await writeContractWithGasBuffer({
          wagmiConfig,
          writeContractAsync: asWriteContractAsyncFn(writeContractAsync),
          account: address,
          chainId,
          address: tc,
          abi: timeArenaWriteAbi,
          functionName: "warbowRevenge",
          args: [stealer],
        });
        await waitForWriteReceipt(wagmiConfig, { hash });
        await refetch();
      } catch (e) {
        setPvpErr(friendlyRevertFromUnknown(e));
      }
    },
    [
      failIfWrongChain,
      writesPaused,
      tc,
      address,
      doub,
      revengeDoubWei,
      wagmiConfig,
      writeContractAsync,
      chainId,
      refetch,
    ],
  );

  return {
    ready: Boolean(tc),
    saleActive,
    isConnected,
    canPress,
    stealVictim,
    guardedActive,
    guardUntilSec: (guardUntilEffective ?? 0n).toString(),
    chainNowSec,
    viewerBattlePoints: viewerBattlePointsEffective?.toString(),
    stealDoubWad: stealDoubWei.toString(),
    guardDoubWad: guardDoubWei.toString(),
    bypassDoubWad: bypassDoubWei.toString(),
    revengeDoubWad: revengeDoubWei.toString(),
    maxStealsPerDay: maxSteals,
    stealVictimInput,
    setStealVictimInput,
    stealVictimFormatError,
    stealBypass,
    setStealBypass,
    pvpErr,
    clearPvpErr: () => setPvpErr(null),
    runWarBowSteal,
    runWarBowGuard,
    runWarBowRevenge,
    isWriting,
    arenaPaused: writesPaused,
  };
}

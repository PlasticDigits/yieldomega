// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback, useMemo, useState } from "react";
import { useAccount, useBlock, useChainId, useConfig, useReadContract, useWriteContract } from "wagmi";
import { isAddress } from "viem";
import { addresses } from "@/lib/addresses";
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
import type { SaleSessionPhase } from "@/pages/arena/arenaSimplePhase";

export function useArenaWarbowHero(phase: SaleSessionPhase) {
  const tc = addresses.timeArena;
  const wagmiConfig = useConfig();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { data: block } = useBlock({ watch: true });
  const { writeContractAsync, isPending: isWriting } = useWriteContract();

  const [stealVictimInput, setStealVictimInput] = useState("");
  const [stealBypass, setStealBypass] = useState(false);
  const [pvpErr, setPvpErr] = useState<string | null>(null);

  const saleActive = phase === "saleActive";
  const chainNowSec = block?.timestamp !== undefined ? Number(block.timestamp) : undefined;

  const readOpts = { address: tc, abi: timeArenaReadAbi, query: { enabled: Boolean(tc) } };
  const { data: doub } = useReadContract({ ...readOpts, functionName: "doub" });
  const { data: paused } = useReadContract({ ...readOpts, functionName: "paused" });
  const { data: stealDoub } = useReadContract({ ...readOpts, functionName: "WARBOW_STEAL_DOUB" });
  const { data: guardDoub } = useReadContract({ ...readOpts, functionName: "WARBOW_GUARD_DOUB" });
  const { data: bypassDoub } = useReadContract({
    ...readOpts,
    functionName: "WARBOW_STEAL_LIMIT_BYPASS_DOUB",
  });
  const { data: revengeDoub } = useReadContract({ ...readOpts, functionName: "WARBOW_REVENGE_DOUB" });
  const { data: maxStealsRaw } = useReadContract({
    ...readOpts,
    functionName: "WARBOW_MAX_STEALS_PER_DAY",
  });
  const { data: secsPerDay } = useReadContract({ ...readOpts, functionName: "SECONDS_PER_DAY" });
  const { data: viewerBp, refetch: refetchBp } = useReadContract({
    ...readOpts,
    functionName: "battlePoints",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(tc && address) },
  });
  const { data: guardUntil, refetch: refetchGuard } = useReadContract({
    ...readOpts,
    functionName: "warbowGuardUntil",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(tc && address) },
  });

  const stealDoubWei = stealDoub ?? 1000n * 10n ** 18n;
  const guardDoubWei = guardDoub ?? 10_000n * 10n ** 18n;
  const bypassDoubWei = bypassDoub ?? 50_000n * 10n ** 18n;
  const revengeDoubWei = revengeDoub ?? 1000n * 10n ** 18n;
  const maxSteals = maxStealsRaw !== undefined ? Number(maxStealsRaw) : 3;
  const daySec = secsPerDay ?? 86_400n;

  const utcDayId =
    chainNowSec !== undefined ? BigInt(Math.floor(chainNowSec / Number(daySec))) : 0n;

  const stealVictim = useMemo(() => {
    const t = stealVictimInput.trim();
    return isAddress(t) ? (t as `0x${string}`) : undefined;
  }, [stealVictimInput]);

  const stealVictimFormatError = warbowStealVictimInputFormatError(stealVictimInput);
  const wrongChain = chainMismatchWriteMessage(chainId) !== null;
  const writesPaused = paused === true;
  const canPress = isConnected && saleActive && !writesPaused && !wrongChain && !isWriting;

  const guardedActive =
    chainNowSec !== undefined && guardUntil !== undefined && guardUntil > 0n
      ? BigInt(chainNowSec) < guardUntil
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
          viewerBattlePoints: viewerBp,
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
    viewerBp,
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
    guardUntilSec: (guardUntil ?? 0n).toString(),
    chainNowSec,
    viewerBattlePoints: viewerBp?.toString(),
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

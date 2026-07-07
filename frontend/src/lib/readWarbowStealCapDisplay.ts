// SPDX-License-Identifier: AGPL-3.0-only

import { readContract } from "wagmi/actions";
import { timeArenaReadAbi } from "@/lib/abis";
import { wagmiConfig } from "@/wagmi-config";

export type WarbowStealCapDisplay = {
  attackerStealsToday?: bigint;
  victimStealsToday?: bigint;
  victimBattlePoints?: bigint;
  victimGuardUntil?: bigint;
};

/** One-shot onchain steal-cap reads for WarBow hero preflight (submit + interactive display). */
export async function readWarbowStealCapDisplay(params: {
  tc: `0x${string}`;
  attacker?: `0x${string}`;
  victim?: `0x${string}`;
  utcDayId: bigint;
}): Promise<WarbowStealCapDisplay> {
  const { tc, attacker, victim, utcDayId } = params;
  const out: WarbowStealCapDisplay = {};

  const tasks: Promise<void>[] = [];

  if (attacker) {
    tasks.push(
      readContract(wagmiConfig, {
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "stealsCommittedByAttackerOnDay",
        args: [attacker, utcDayId],
      }).then((value) => {
        out.attackerStealsToday = BigInt(value);
      }),
    );
  }

  if (victim) {
    tasks.push(
      readContract(wagmiConfig, {
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "stealsReceivedOnDay",
        args: [victim, utcDayId],
      }).then((value) => {
        out.victimStealsToday = BigInt(value);
      }),
      readContract(wagmiConfig, {
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "battlePoints",
        args: [victim],
      }).then((value) => {
        out.victimBattlePoints = BigInt(value);
      }),
      readContract(wagmiConfig, {
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "warbowGuardUntil",
        args: [victim],
      }).then((value) => {
        out.victimGuardUntil = BigInt(value);
      }),
    );
  }

  await Promise.all(tasks);
  return out;
}

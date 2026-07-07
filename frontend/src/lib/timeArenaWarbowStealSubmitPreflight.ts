// SPDX-License-Identifier: AGPL-3.0-only

import { readContract } from "wagmi/actions";
import { timeArenaReadAbi } from "@/lib/abis";
import { wagmiConfig } from "@/wagmi-config";

export type FreshWarbowStealPreflight = {
  victimBattlePoints: bigint;
  victimStealsToday: bigint;
  victimGuardUntil: bigint;
  attackerStealsToday?: bigint;
};

/** Fresh onchain reads immediately before `warbowSteal` submit ([#216](https://gitlab.com/PlasticDigits/yieldomega/-/issues/216), [#101](https://gitlab.com/PlasticDigits/yieldomega/-/issues/101)). */
export async function readFreshWarbowStealPreflight(params: {
  tc: `0x${string}`;
  victim: `0x${string}`;
  attacker?: `0x${string}`;
  utcDayId: bigint;
}): Promise<FreshWarbowStealPreflight> {
  const { tc, victim, attacker, utcDayId } = params;
  const [victimBattlePoints, victimStealsToday, victimGuardUntil, attackerStealsToday] =
    await Promise.all([
      readContract(wagmiConfig, {
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "battlePoints",
        args: [victim],
      }),
      readContract(wagmiConfig, {
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "stealsReceivedOnDay",
        args: [victim, utcDayId],
      }),
      readContract(wagmiConfig, {
        address: tc,
        abi: timeArenaReadAbi,
        functionName: "warbowGuardUntil",
        args: [victim],
      }),
      attacker
        ? readContract(wagmiConfig, {
            address: tc,
            abi: timeArenaReadAbi,
            functionName: "stealsCommittedByAttackerOnDay",
            args: [attacker, utcDayId],
          })
        : Promise.resolve(undefined),
    ]);
  return {
    victimBattlePoints: BigInt(victimBattlePoints),
    victimStealsToday: BigInt(victimStealsToday),
    victimGuardUntil: BigInt(victimGuardUntil),
    attackerStealsToday:
      attackerStealsToday !== undefined ? BigInt(attackerStealsToday) : undefined,
  };
}

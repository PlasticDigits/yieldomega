// SPDX-License-Identifier: AGPL-3.0-only

import type { CredCheckoutBoundsGate } from "@/lib/arenaCredBurn";
import { chainMismatchWriteMessage } from "@/lib/chainMismatchWriteGuard";
import {
  resolveLiveWriteConnector,
  WALLET_WRITE_NOT_READY_MESSAGE,
} from "@/lib/walletBuySessionGuard";
import { wagmiConfig } from "@/wagmi-config";
import type { HexAddress } from "@/lib/addresses";
import type { PayWithAsset } from "@/lib/kumbayaRoutes";

type ContractReadRow = {
  status: "success" | "failure";
  result?: unknown;
};

export type ArenaSaleSessionBuyPreflightInput = {
  walletStatus: string;
  chainId: number;
  address: HexAddress | undefined;
  timeArenaAddress: HexAddress | undefined;
  acceptedAsset: HexAddress | undefined;
  arenaPaused: boolean | undefined;
  payWith: PayWithAsset;
  playCredConfigured: boolean;
  playCredAddress: HexAddress | undefined;
  credCheckoutBoundsGate: CredCheckoutBoundsGate;
  walletCooldownRemainingSec: number;
  charmWadSelected: bigint | undefined;
  isArenaV2: boolean;
  charmBoundsR: ContractReadRow | undefined;
  hasLatchedCharmBounds: boolean;
};

/** Sync submit guards shared by {@link useArenaSaleSession} `submitBuy`. */
export function arenaSaleSessionBuyPreflight(
  input: ArenaSaleSessionBuyPreflightInput,
): string | null {
  if (input.walletStatus !== "connected" || !resolveLiveWriteConnector(wagmiConfig)) {
    return WALLET_WRITE_NOT_READY_MESSAGE;
  }
  const netErr = chainMismatchWriteMessage(input.chainId);
  if (netErr) return netErr;
  if (!input.address || !input.timeArenaAddress || !input.acceptedAsset) {
    return "Connect a wallet and wait for arena state (indexer or contract reads).";
  }
  if (input.arenaPaused === true) {
    return "Time Arena is paused — buys and WarBow DOUB spend are disabled until operators unpause.";
  }
  if (input.payWith === "cred") {
    if (!input.playCredConfigured || !input.playCredAddress) {
      return "Play CRED is not configured on this arena.";
    }
    if (input.credCheckoutBoundsGate.kind === "insufficient_cred") {
      return "Not enough Play CRED in your wallet for this CHARM amount.";
    }
  }
  if (input.walletCooldownRemainingSec > 0) {
    return "TimeArena: burst cooldown";
  }
  if (input.charmWadSelected === undefined || input.charmWadSelected <= 0n) {
    return `Pick a ${input.isArenaV2 ? "DOUB" : "CL8Y"} amount inside the live min–max band (and your balance).`;
  }
  if (input.charmBoundsR?.status !== "success" && !input.hasLatchedCharmBounds) {
    return "Waiting for onchain CHARM bounds.";
  }
  return null;
}

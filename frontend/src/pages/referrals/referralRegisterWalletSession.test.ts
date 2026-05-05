// SPDX-License-Identifier: AGPL-3.0-only
//
// [`ReferralRegisterSection`](./ReferralRegisterSection.tsx) latches the same guard as TimeCurve buys
// ([GitLab #155](https://gitlab.com/PlasticDigits/yieldomega/-/issues/155) ↔ **`INV-REFERRAL-SESSION-155`**).

import type { Config } from "wagmi";
import * as wagmiActions from "wagmi/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  WALLET_BUY_SESSION_DRIFT_MESSAGE,
  assertWalletBuySessionUnchanged,
  captureWalletBuySession,
  type WalletBuySessionSnapshot,
} from "@/lib/walletBuySessionGuard";

vi.mock("wagmi/actions", async (importOriginal) => {
  const mod = await importOriginal<typeof import("wagmi/actions")>();
  return {
    ...mod,
    getAccount: vi.fn(mod.getAccount),
  };
});

const getAccount = vi.mocked(wagmiActions.getAccount);

const SNAP: WalletBuySessionSnapshot = {
  address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  chainId: 31337,
};

const dummyConfig = {} as Config;

function connectedSnapshot(addr: `0x${string}`, chainId: number) {
  return {
    address: addr,
    addresses: [addr] as const,
    chain: undefined,
    chainId,
    connector: undefined,
    isConnected: true as const,
    isConnecting: false as const,
    isDisconnected: false as const,
    isReconnecting: false as const,
    status: "connected" as const,
  } as unknown as ReturnType<typeof wagmiActions.getAccount>;
}

describe("referral registration wallet session latch (GitLab #155)", () => {
  beforeEach(() => {
    getAccount.mockReset();
  });

  it("captureWalletBuySession matches ReferralRegisterSection preflight", () => {
    getAccount.mockReturnValue(connectedSnapshot(SNAP.address, SNAP.chainId));
    expect(captureWalletBuySession(dummyConfig)).toEqual(SNAP);
  });

  it("assertWalletBuySessionUnchanged aborts after an account switch (mirrors mid-flow guard)", () => {
    getAccount
      .mockReturnValueOnce(connectedSnapshot(SNAP.address, SNAP.chainId))
      .mockReturnValueOnce(connectedSnapshot("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", SNAP.chainId));
    expect(captureWalletBuySession(dummyConfig)).toEqual(SNAP);
    expect(() => assertWalletBuySessionUnchanged(dummyConfig, SNAP)).toThrow(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("assertWalletBuySessionUnchanged aborts after a chain switch", () => {
    getAccount
      .mockReturnValueOnce(connectedSnapshot(SNAP.address, SNAP.chainId))
      .mockReturnValueOnce(connectedSnapshot(SNAP.address, 1));
    expect(captureWalletBuySession(dummyConfig)).toEqual(SNAP);
    expect(() => assertWalletBuySessionUnchanged(dummyConfig, SNAP)).toThrow(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });
});

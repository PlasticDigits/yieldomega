// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  WALLET_BUY_SESSION_DRIFT_MESSAGE,
  walletBuySessionDriftFromState,
  type WalletBuySessionSnapshot,
} from "@/lib/walletBuySessionGuard";

const SNAP: WalletBuySessionSnapshot = {
  address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  chainId: 31337,
};

describe("walletBuySessionDriftFromState", () => {
  it("returns null when connected address and chain match", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "connected", address: SNAP.address, chainId: SNAP.chainId },
        SNAP,
      ),
    ).toBeNull();
  });

  it("matches addresses case-insensitively", () => {
    expect(
      walletBuySessionDriftFromState(
        {
          status: "connected",
          address: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          chainId: 31337,
        },
        {
          address: "0xAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAaAa",
          chainId: 31337,
        },
      ),
    ).toBeNull();
  });

  it("flags disconnected status", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "disconnected", address: undefined, chainId: undefined },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags reconnecting status", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "reconnecting", address: SNAP.address, chainId: SNAP.chainId },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags account switch", () => {
    expect(
      walletBuySessionDriftFromState(
        {
          status: "connected",
          address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
          chainId: SNAP.chainId,
        },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags chain switch", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "connected", address: SNAP.address, chainId: 1 },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });

  it("flags missing address while allegedly connected", () => {
    expect(
      walletBuySessionDriftFromState(
        { status: "connected", address: undefined, chainId: SNAP.chainId },
        SNAP,
      ),
    ).toBe(WALLET_BUY_SESSION_DRIFT_MESSAGE);
  });
});

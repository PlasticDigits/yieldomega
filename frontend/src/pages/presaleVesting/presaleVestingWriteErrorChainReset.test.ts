// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { shouldResetWriteContractErrorAfterChainTransition } from "@/pages/presaleVesting/presaleVestingWriteErrorChainReset";

const target31337 = { VITE_CHAIN_ID: "31337", VITE_RPC_URL: "http://127.0.0.1:8545" } as const;

describe("shouldResetWriteContractErrorAfterChainTransition", () => {
  it("returns false when there is no write error", () => {
    expect(
      shouldResetWriteContractErrorAfterChainTransition(56, 31337, false, target31337),
    ).toBe(false);
  });

  it("returns false on first paint (previous === current target) even if error is set", () => {
    expect(
      shouldResetWriteContractErrorAfterChainTransition(31337, 31337, true, target31337),
    ).toBe(false);
  });

  it("returns false when staying on a wrong chain with an error", () => {
    expect(shouldResetWriteContractErrorAfterChainTransition(56, 56, true, target31337)).toBe(false);
  });

  it("returns true when transitioning wrong-chain → target with a stale wagmi error", () => {
    expect(
      shouldResetWriteContractErrorAfterChainTransition(56, 31337, true, target31337),
    ).toBe(true);
  });

  it("returns false when transitioning target → wrong-chain (error may still be shown until switch back)", () => {
    expect(
      shouldResetWriteContractErrorAfterChainTransition(31337, 56, true, target31337),
    ).toBe(false);
  });
});

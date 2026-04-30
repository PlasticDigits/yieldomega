// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { chainMismatchWriteMessage } from "./chainMismatchWriteGuard";

describe("chainMismatchWriteMessage", () => {
  it("returns null when wallet matches target from env slice", () => {
    expect(
      chainMismatchWriteMessage(42, { VITE_CHAIN_ID: "42", VITE_RPC_URL: "" }),
    ).toBeNull();
  });

  it("reports mismatch when ids differ", () => {
    const msg = chainMismatchWriteMessage(1, {
      VITE_CHAIN_ID: "31337",
      VITE_RPC_URL: "http://127.0.0.1:8545",
    });
    expect(msg).toContain("Wrong network");
    expect(msg).toContain("31337");
    expect(msg).toContain("1");
  });
});

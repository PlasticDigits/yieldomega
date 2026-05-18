// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  BUY_TRANSACTION_REVERTED_MESSAGE,
  assertSuccessfulBuyReceipt,
} from "./timeCurveBuyReceipt";

describe("assertSuccessfulBuyReceipt", () => {
  it("throws on reverted receipts", () => {
    expect(() => assertSuccessfulBuyReceipt({ status: "reverted" })).toThrow(
      BUY_TRANSACTION_REVERTED_MESSAGE,
    );
  });

  it("no-ops on success or unknown status", () => {
    expect(() => assertSuccessfulBuyReceipt({ status: "success" })).not.toThrow();
    expect(() => assertSuccessfulBuyReceipt({ status: null })).not.toThrow();
    expect(() => assertSuccessfulBuyReceipt({})).not.toThrow();
  });
});

// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  grossCl8yWithQuoteHeadroom,
  KUMBAYA_GROSS_CL8Y_QUOTE_HEADROOM_BPS,
} from "./kumbayaQuoter";

describe("grossCl8yWithQuoteHeadroom", () => {
  it("adds configured BPS to gross CL8Y for swap max-in sizing", () => {
    const gross = 1_320_000_000_000_000_000n;
    const buffered = grossCl8yWithQuoteHeadroom(gross);
    expect(buffered).toBe(
      (gross * (10_000n + BigInt(KUMBAYA_GROSS_CL8Y_QUOTE_HEADROOM_BPS))) / 10_000n,
    );
    expect(buffered).toBeGreaterThan(gross);
  });
});

// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { formatKumbayaWei, isKumbayaBuyDebugEnabled } from "./kumbayaBuyDebug";

describe("kumbayaBuyDebug", () => {
  it("formats wei for logs", () => {
    expect(formatKumbayaWei(1_000_000_000_000_000_000n, 18, "ETH")).toBe("1 ETH");
  });

  it("is enabled in vitest dev mode", () => {
    expect(isKumbayaBuyDebugEnabled()).toBe(true);
  });
});

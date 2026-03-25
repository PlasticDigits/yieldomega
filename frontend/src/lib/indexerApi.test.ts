// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { rabbitDepositsApiPath } from "./indexerApi";

describe("rabbitDepositsApiPath", () => {
  it("omits user query when undefined", () => {
    expect(rabbitDepositsApiPath(undefined, 20)).toBe("/v1/rabbit/deposits?limit=20");
  });

  it("encodes user for query injection safety", () => {
    const malicious = "0xabc&limit=999";
    expect(rabbitDepositsApiPath(malicious, 20)).toBe(
      `/v1/rabbit/deposits?limit=20&user=${encodeURIComponent(malicious)}`,
    );
  });
});

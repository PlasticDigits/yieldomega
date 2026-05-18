// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { extractHttpResponseStatus } from "./extractHttpResponseStatus";

describe("extractHttpResponseStatus", () => {
  it("reads status on shaped errors", () => {
    expect(extractHttpResponseStatus({ status: 429 })).toBe(429);
    expect(
      extractHttpResponseStatus({
        cause: { response: { status: 429 } },
      }),
    ).toBe(429);
  });

  it("returns undefined for unrelated values", () => {
    expect(extractHttpResponseStatus(null)).toBeUndefined();
    expect(extractHttpResponseStatus({ message: "boop" })).toBeUndefined();
  });
});

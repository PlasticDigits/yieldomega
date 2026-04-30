// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { humanizeIdentifierToken, humanizeKvLabel } from "./humanizeIdentifier";

describe("humanizeIdentifierToken", () => {
  it("formats SCREAMING_SNAKE_CASE per segment", () => {
    expect(humanizeIdentifierToken("WARBOW_FLAG_SILENCE_SEC")).toBe("Warbow Flag Silence Sec");
  });

  it("formats camelCase", () => {
    expect(humanizeIdentifierToken("warbowPendingFlagOwner")).toBe("Warbow Pending Flag Owner");
  });
});

describe("humanizeKvLabel", () => {
  it("keeps multi-token lowercase prose", () => {
    expect(humanizeKvLabel("seconds remaining")).toBe("seconds remaining");
  });

  it("handles trailing parenthetical notes on identifiers", () => {
    expect(humanizeKvLabel("acceptedAsset (CL8Y)")).toBe("Accepted Asset (CL8Y)");
    expect(humanizeKvLabel("initialMinBuy (envelope ref)")).toBe("Initial Min Buy (envelope ref)");
  });

  it("humanizes spaced identifier pairs", () => {
    expect(humanizeKvLabel("charmPrice basePriceWad")).toBe("Charm Price · Base Price Wad");
  });
});

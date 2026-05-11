// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { formatRelativeFreshnessEnglish } from "./cl8yUsdEquivalentDisplay";

describe("formatRelativeFreshnessEnglish (GitLab #192)", () => {
  it("returns just now for very recent anchors", () => {
    const t = 1_700_000_000_000;
    expect(formatRelativeFreshnessEnglish(t, t + 2000)).toBe("just now");
  });

  it("returns seconds for sub-minute gaps", () => {
    const t = 1_700_000_000_000;
    expect(formatRelativeFreshnessEnglish(t, t + 30_000)).toBe("30s ago");
  });

  it("returns minutes for sub-hour gaps", () => {
    const t = 1_700_000_000_000;
    expect(formatRelativeFreshnessEnglish(t, t + 5 * 60_000)).toBe("5m ago");
  });

  it("returns hours for multi-hour gaps under 48h", () => {
    const t = 1_700_000_000_000;
    expect(formatRelativeFreshnessEnglish(t, t + 3 * 3600_000)).toBe("3h ago");
  });

  it("returns days for very old anchors", () => {
    const t = 1_700_000_000_000;
    expect(formatRelativeFreshnessEnglish(t, t + 72 * 3600_000)).toBe("3d ago");
  });
});

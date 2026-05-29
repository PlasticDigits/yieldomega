// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { DONATE_DISCLOSURE } from "./TimeCurveProtocolDonatePoolsSection";

describe("TimeCurveProtocolDonatePoolsSection (GitLab #262)", () => {
  it("exposes required no-benefit disclosure copy", () => {
    expect(DONATE_DISCLOSURE).toContain("does not provide you with any benefit");
  });
});

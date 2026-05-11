// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import {
  formatBuyHubDerivedCompact,
  TIMECURVE_BUY_HUB_DERIVED_SIGFIGS,
} from "@/lib/timeCurveBuyHubFormat";

describe("timeCurveBuyHubFormat", () => {
  it("uses the same output as formatCompactFromRaw with four sigfigs", () => {
    const raw = 1234567890123456789n;
    expect(formatBuyHubDerivedCompact(raw, 18)).toEqual(
      formatCompactFromRaw(raw, 18, { sigfigs: TIMECURVE_BUY_HUB_DERIVED_SIGFIGS }),
    );
  });
});

// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import {
  formatBuyCtaCharmAmountLabel,
  formatBuyHubDerivedCompact,
  formatBuyHubLaunchVsClearingGainPercentLabel,
  formatHeroRateFromWad,
  TIMECURVE_BUY_HUB_DERIVED_SIGFIGS,
} from "@/lib/timeCurveBuyHubFormat";

describe("timeCurveBuyHubFormat", () => {
  it("formats hero per-CHARM rate from wad to six truncated significant figures", () => {
    // 1.011420 * 1e18 wei (approx)
    const wei = 1011420000000000000n;
    expect(formatHeroRateFromWad(wei)).toBe("1.01142");
  });

  it("truncates hero rate toward zero and never rounds up at the last sigfig", () => {
    expect(formatHeroRateFromWad(1011425000000000000n)).toBe("1.01142");
  });

  it("pads trailing zeros in hero rate labels to six significant figures", () => {
    expect(formatHeroRateFromWad(1010000000000000000n)).toBe("1.01000");
  });

  it("uses the same output as formatCompactFromRaw with four sigfigs", () => {
    const raw = 1234567890123456789n;
    expect(formatBuyHubDerivedCompact(raw, 18)).toEqual(
      formatCompactFromRaw(raw, 18, { sigfigs: TIMECURVE_BUY_HUB_DERIVED_SIGFIGS }),
    );
  });

  it("formats launch vs clearing CL8Y gain to four sigfigs (+27.50% at 1.275× anchor)", () => {
    expect(
      formatBuyHubLaunchVsClearingGainPercentLabel({
        clearingSpendCl8yWei: 1000n,
        approxLaunchCl8yWei: 1275n,
      }),
    ).toBe("+27.50% GAIN");
  });

  it("formats buy CTA CHARM amount to four truncated significant figures (compact scientific exponents)", () => {
    expect(formatBuyCtaCharmAmountLabel(9086n * 10n ** 18n)).toBe("9086");
    expect(formatBuyCtaCharmAmountLabel(1n * 10n ** 18n)).toBe("1");
    expect(formatBuyCtaCharmAmountLabel(1234n * 10n ** 15n)).toBe("1.234");
    // Rounding would give 10.27; truncation matches earn-line style precision.
    expect(formatBuyCtaCharmAmountLabel(10269999999999999999n)).toBe("10.26");
  });

  it("returns null when spend or launch projection is missing or non-positive", () => {
    expect(
      formatBuyHubLaunchVsClearingGainPercentLabel({
        clearingSpendCl8yWei: undefined,
        approxLaunchCl8yWei: 100n,
      }),
    ).toBeNull();
    expect(
      formatBuyHubLaunchVsClearingGainPercentLabel({
        clearingSpendCl8yWei: 0n,
        approxLaunchCl8yWei: 100n,
      }),
    ).toBeNull();
  });
});

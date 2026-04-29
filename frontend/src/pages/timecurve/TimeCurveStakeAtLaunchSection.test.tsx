// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { TimeCurveStakeAtLaunchSectionProps } from "./TimeCurveStakeAtLaunchSection";
import { TimeCurveStakeAtLaunchSection } from "./TimeCurveStakeAtLaunchSection";

const WAD = 10n ** 18n;

function renderStake(overrides: Partial<TimeCurveStakeAtLaunchSectionProps> = {}): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/timecurve"] },
      createElement(TimeCurveStakeAtLaunchSection, {
        visible: true,
        charmWeightWad: 3n * WAD,
        launchCl8yValueWei: 4n * WAD,
        decimals: 18,
        charmsRedeemed: false,
        expectedTokenFromCharms: undefined,
        launchHelperCopy: "1 CHARM ≈ 1 CL8Y at launch",
        ...overrides,
      }),
    ),
  );
}

describe("TimeCurveStakeAtLaunchSection (issue #90)", () => {
  it("renders nothing when not visible", () => {
    const html = renderStake({ visible: false });
    expect(html).toBe("");
  });

  it("shows settled chrome, redeemed DOUB row, and struck CL8Y when charmsRedeemed", () => {
    const html = renderStake({
      charmsRedeemed: true,
      expectedTokenFromCharms: 12345n * WAD,
    });
    expect(html).toContain("timecurve-simple__stake-panel--redeemed");
    expect(html).toContain("timecurve-simple__stake-settled-actions");
    expect(html).toContain(">Settled<");
    expect(html).toContain('data-testid="timecurve-simple-stake-redeemed-doub"');
    expect(html).toContain("timecurve-simple__stake-tile-value--redeemed-struck");
    expect(html).toContain("(redeemed)");
    expect(html).toContain("timecurve-simple__stake-redeemed-row");
  });

  it("does not show redeemed UI while sale-active viewer path would still have charmsRedeemed false", () => {
    const html = renderStake({ charmsRedeemed: false });
    expect(html).not.toContain("timecurve-simple__stake-redeemed-row");
    expect(html).not.toContain("timecurve-simple__stake-tile-value--redeemed-struck");
  });
});

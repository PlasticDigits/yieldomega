// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { fallbackPayTokenWeiForCl8y } from "@/lib/kumbayaDisplayFallback";
import type { TimeCurveStakeAtLaunchSectionProps } from "./TimeCurveStakeAtLaunchSection";
import { TimeCurveStakeAtLaunchSection } from "./TimeCurveStakeAtLaunchSection";

const WAD = 10n ** 18n;

function renderStake(overrides: Partial<TimeCurveStakeAtLaunchSectionProps> = {}): string {
  const launchCl8yValueWei = overrides.launchCl8yValueWei ?? 4n * WAD;
  const payWith = overrides.payWith ?? "cl8y";
  const stakeLaunchEquivPayWei =
    overrides.stakeLaunchEquivPayWei ??
    (payWith === "cl8y"
      ? launchCl8yValueWei
      : launchCl8yValueWei !== undefined
        ? fallbackPayTokenWeiForCl8y(launchCl8yValueWei, payWith)
        : undefined);
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/timecurve"] },
      createElement(TimeCurveStakeAtLaunchSection, {
        visible: true,
        charmWeightWad: 3n * WAD,
        launchCl8yValueWei,
        payWith,
        payTokenDecimals: overrides.payTokenDecimals ?? 18,
        stakeLaunchEquivPayWei,
        stakeLaunchEquivQuoteLoading: overrides.stakeLaunchEquivQuoteLoading ?? false,
        decimals: 18,
        charmsRedeemed: false,
        expectedTokenFromCharms: undefined,
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
    expect(html).toContain("section-heading__lede");
  });

  it("renders YOUR CHARM primary line and green ≈ CL8Y line when active", () => {
    const html = renderStake({ charmsRedeemed: false });
    expect(html).toContain("timecurve-simple__stake-combined-line--primary");
    expect(html).toContain("timecurve-simple__stake-combined-line--approx");
    expect(html).toContain("timecurve-simple__stake-panel--has-charm");
    expect(html).toContain("/art/cutouts/mascot-bunnyleprechaungirl-jump-cutout.png");
    expect(html).toContain("Nice Stash!");
    expect(html).toContain("YOUR CHARM:");
    expect(html).toContain("≈");
    expect(html).toContain(" CL8Y");
    expect(html).toContain('data-testid="timecurve-simple-stake-charm"');
    expect(html).toContain('data-testid="timecurve-simple-stake-launch-equiv"');
    expect(html).toContain("timecurve-simple__stake-combined-usd");
    expect(html).toContain("(3.92 USD)");
    expect(html).toMatch(/<div[^>]*class="[^"]*data-panel[^"]*timecurve-simple__stake-panel/);
  });

  it("nudges zero-CHARM wallets to buy CHARM with the leprechaun girl cutout", () => {
    const html = renderStake({
      charmWeightWad: 0n,
      launchCl8yValueWei: 0n,
      stakeLaunchEquivPayWei: 0n,
    });
    expect(html).toContain("timecurve-simple__stake-panel--no-charm");
    expect(html).toContain("BUY CHARM");
    expect(html).toContain("No CHARM yet. BUY CHARM above");
    expect(html).toContain("/art/cutouts/cutout-bunnyleprechaungirl-playful.png");
  });

  it("does not show redeemed UI while sale-active viewer path would still have charmsRedeemed false", () => {
    const html = renderStake({ charmsRedeemed: false });
    expect(html).not.toContain("timecurve-simple__stake-redeemed-row");
    expect(html).not.toContain("timecurve-simple__stake-tile-value--redeemed-struck");
    expect(html).not.toContain("section-heading__lede");
  });

  it("shows ≈ line in ETH when payWith is eth", () => {
    const html = renderStake({ payWith: "eth" });
    expect(html).toContain(" ETH");
    expect(html).toContain('class="timecurve-simple__stake-combined-token"> ETH');
    expect(html).not.toContain('class="timecurve-simple__stake-combined-token"> CL8Y');
    expect(html).toContain('data-testid="timecurve-simple-stake-launch-equiv"');
  });

  it("shows refreshing placeholder when stake launch quote is loading", () => {
    const html = renderStake({
      payWith: "usdm",
      stakeLaunchEquivQuoteLoading: true,
    });
    expect(html).toContain("Refreshing quote");
    expect(html).not.toContain('data-testid="timecurve-simple-stake-launch-equiv"');
  });
});

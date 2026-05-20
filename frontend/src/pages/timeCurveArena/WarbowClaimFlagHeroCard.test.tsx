// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WarbowClaimFlagHeroCard } from "./WarbowClaimFlagHeroCard";

function renderClaim(overrides: Partial<Parameters<typeof WarbowClaimFlagHeroCard>[0]> = {}) {
  const props: Parameters<typeof WarbowClaimFlagHeroCard>[0] = {
    visible: true,
    canClaimWarBowFlag: false,
    ledgerNowSec: 1_000_000,
    flagSilenceEndSec: 1_000_200n,
    warbowFlagClaimBp: 1000n,
    saleActive: true,
    buyFeeRoutingEnabled: true,
    isConnected: true,
    isWriting: false,
    runWarBowClaimFlag: async () => {},
    ...overrides,
  };
  return renderToStaticMarkup(createElement(WarbowClaimFlagHeroCard, props));
}

describe("WarbowClaimFlagHeroCard", () => {
  it("renders nothing when not visible", () => {
    const html = renderClaim({ visible: false });
    expect(html).toBe("");
  });

  it("shows disabled CTA with hh:mm:ss countdown during silence", () => {
    const html = renderClaim({
      canClaimWarBowFlag: false,
      ledgerNowSec: 1_000_000,
      flagSilenceEndSec: 1_000_200n,
    });
    expect(html).toContain("data-testid=\"warbow-hero-claim-flag\"");
    expect(html).toContain("Claim flag 00:03:20");
    expect(html).toMatch(/disabled/);
    expect(html).toContain("+1,000 BP if you claim after the silence window");
    expect(html).toContain("−2,000 BP if another wallet buys after silence ends");
    expect(html).toContain("without the 2× penalty");
  });

  it("enables the CTA when silence elapsed and sale is live", () => {
    const html = renderClaim({
      canClaimWarBowFlag: true,
      ledgerNowSec: 1_000_300,
      flagSilenceEndSec: 1_000_200n,
    });
    expect(html).toContain(">Claim flag<");
    expect(html).not.toContain("Claim flag 00:");
    expect(html).not.toMatch(/disabled/);
  });

  it("keeps the CTA disabled when fee routing is paused even after silence", () => {
    const html = renderClaim({
      canClaimWarBowFlag: true,
      buyFeeRoutingEnabled: false,
    });
    expect(html).toMatch(/disabled/);
  });
});

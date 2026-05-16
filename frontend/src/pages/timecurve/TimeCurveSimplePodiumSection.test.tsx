// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TimeCurveSimplePodiumSection, type TimeCurveSimplePodiumSectionProps } from "./TimeCurveSimplePodiumSection";

const ALICE = "0x1111111111111111111111111111111111111111" as const;
const BOB = "0x2222222222222222222222222222222222222222" as const;
const CAROL = "0x3333333333333333333333333333333333333333" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

function renderSimplePodiums(overrides: Partial<TimeCurveSimplePodiumSectionProps> = {}): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: ["/timecurve"] }, createElement(TimeCurveSimplePodiumSection, {
      podiumRows: [
        { winners: [ALICE, BOB, CAROL], values: ["9", "8", "7"] },
        { winners: [BOB, ALICE, CAROL], values: ["1200", "900", "400"] },
        { winners: [CAROL, BOB, ALICE], values: ["4", "3", "2"] },
        { winners: [ALICE, CAROL, BOB], values: ["300", "240", "60"] },
      ],
      podiumLoading: false,
      podiumPayoutPreview: [
        { places: ["1600000000000000000", "800000000000000000", "600000000000000000"] },
        { places: ["1000000000000000000", "500000000000000000", "375000000000000000"] },
        { places: ["800000000000000000", "400000000000000000", "300000000000000000"] },
        { places: ["600000000000000000", "300000000000000000", "225000000000000000"] },
      ],
      decimals: 18,
      address: undefined,
      podiumNowUnixSec: 1_700_000_000,
      recentBuys: null,
      ...overrides,
    })),
  );
}

describe("TimeCurveSimplePodiumSection (issue #113)", () => {
  it("renders all four canonical podium categories and three placements", () => {
    const html = renderSimplePodiums();
    expect(html).toContain('data-testid="timecurve-simple-podiums"');
    expect(html).toContain("Prize podiums");
    expect(html).toContain("Last Buy");
    expect(html).toContain("WarBow");
    expect(html).toContain('href="/timecurve/arena"');
    expect(html).toContain("Defended Streak");
    expect(html).toContain("Time Booster");
    expect(html.match(/class="ranking-list__item/g)?.length).toBe(12);
    expect(html).toContain("/art/icons/timecurve-podium-rank-first.png");
    expect(html).toContain("/art/icons/timecurve-podium-rank-second.png");
    expect(html).toContain("/art/icons/timecurve-podium-rank-third.png");
    expect(html).toContain("1st prize");
    expect(html).toContain("CL8Y");
    expect(html).toContain("≈ $1.57 USD");
    expect(html).toContain("1.6");
    expect(html).not.toContain("predicted leader");
    expect(html).not.toContain("Indexer-backed snapshot");
    expect(html.indexOf("1.6")).toBeLessThan(html.indexOf("0x1111"));
    expect(html).toContain("Score: —");
    expect(html).toContain("Score: 1200 Battle Points");
    expect(html).toContain("Score: 900 Battle Points");
    expect(html).toContain("Score: 4 sequential buys");
    expect(html).toContain("Score: 300s added");
    expect(html).toMatch(/address-inline__label">111111</);
    expect(html).not.toMatch(/address-inline__label">0x/);
  });

  it("highlights placements that match the connected wallet", () => {
    const html = renderSimplePodiums({ address: ALICE });
    expect(html).toContain("ranking-list__item--you");
  });

  it("Defended Streak rows show no-streak guidance when on-chain streak values are zero", () => {
    const html = renderSimplePodiums({
      podiumRows: [
        { winners: [ALICE, BOB, CAROL], values: ["9", "8", "7"] },
        { winners: [BOB, ALICE, CAROL], values: ["1200", "900", "400"] },
        { winners: [ALICE, BOB, CAROL], values: ["0", "0", "0"] },
        { winners: [ALICE, CAROL, BOB], values: ["300", "240", "60"] },
      ],
    });
    expect(html).toContain("No buy streaks until timer under 15 minutes!");
  });

  it("shows a neutral em dash for empty winner slots (no wallet-connect wording)", () => {
    const html = renderSimplePodiums({
      podiumRows: [{ winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] }],
    });
    expect(html).toContain("—");
    expect(html).not.toContain("Awaiting wallet");
    expect(html).toContain("1.6");
    expect(html).toContain("CL8Y");
  });
});

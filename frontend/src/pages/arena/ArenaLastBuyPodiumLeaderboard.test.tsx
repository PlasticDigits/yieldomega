// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  ArenaLastBuyPodiumLeaderboard,
  type ArenaLastBuyPodiumLeaderboardProps,
} from "./ArenaLastBuyPodiumLeaderboard";

const ALICE = "0x1111111111111111111111111111111111111111" as const;
const BOB = "0x2222222222222222222222222222222222222222" as const;
const CAROL = "0x3333333333333333333333333333333333333333" as const;

function renderLeaderboard(overrides: Partial<ArenaLastBuyPodiumLeaderboardProps> = {}): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      createElement(ArenaLastBuyPodiumLeaderboard, {
        decimals: 18,
        podiumRow: {
          winners: [ALICE, BOB, CAROL],
          values: ["3", "2", "1"],
          winnerBuySec: ["1700000000", "1699999990", "1699999980"],
          epoch: "12",
        },
        podiumPayoutPreview: [
          { places: ["1600000000000000000", "800000000000000000", "600000000000000000"] },
        ],
        podiumNowUnixSec: 1_700_000_020,
        recentBuys: null,
        ...overrides,
      }),
    ),
  );
}

describe("ArenaLastBuyPodiumLeaderboard", () => {
  it("renders three stands in 2nd-1st-3rd visual order with rank icons and prizes", () => {
    const html = renderLeaderboard();
    expect(html).toContain('data-testid="arena-last-buy-podium-leaderboard"');
    expect(html).toContain('data-testid="arena-last-buy-podium-2"');
    expect(html).toContain('data-testid="arena-last-buy-podium-1"');
    expect(html).toContain('data-testid="arena-last-buy-podium-3"');
    expect(html).toContain("/art/icons/arena-podium-rank-first.png");
    expect(html).toContain("/art/icons/arena-podium-rank-second.png");
    expect(html).toContain("/art/icons/arena-podium-rank-third.png");
    expect(html).toContain("DOUB");
    expect(html).toContain("≈$1.57 USD");

    const secondPos = html.indexOf('data-testid="arena-last-buy-podium-2"');
    const firstPos = html.indexOf('data-testid="arena-last-buy-podium-1"');
    const thirdPos = html.indexOf('data-testid="arena-last-buy-podium-3"');
    expect(secondPos).toBeLessThan(firstPos);
    expect(firstPos).toBeLessThan(thirdPos);
    expect(html).toContain("arena-simple__last-buy-podium--first");
  });

  it("shows live seconds-since-buy and wires wallet profile buttons", () => {
    const html = renderLeaderboard({ onOpenWalletProfile: () => {} });
    expect(html).toContain("20s");
    expect(html).toContain("30s");
    expect(html).toContain("40s");
    expect(html).toContain("address-inline__profile-btn");
  });

  it("highlights and glows the connected wallet stand", () => {
    const html = renderLeaderboard({ address: BOB });
    expect(html).toContain("arena-simple__last-buy-podium--you");
    expect(html).toMatch(/address-inline__label">222222/);
  });
});

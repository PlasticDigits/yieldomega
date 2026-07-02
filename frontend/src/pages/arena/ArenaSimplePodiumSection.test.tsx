// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ArenaSimplePodiumSection, type ArenaSimplePodiumSectionProps } from "./ArenaSimplePodiumSection";

const ALICE = "0x1111111111111111111111111111111111111111" as const;
const BOB = "0x2222222222222222222222222222222222222222" as const;
const CAROL = "0x3333333333333333333333333333333333333333" as const;
const ZERO = "0x0000000000000000000000000000000000000000" as const;

const noopFeatureHelp = () => {};

function renderSimplePodiums(overrides: Partial<ArenaSimplePodiumSectionProps> = {}): string {
  return renderToStaticMarkup(
    createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(ArenaSimplePodiumSection, {
      onFeatureHelp: noopFeatureHelp,
      podiumRows: [
        { winners: [ALICE, BOB, CAROL], values: ["9", "8", "7"], epoch: "12" },
        { winners: [BOB, ALICE, CAROL], values: ["1200", "900", "400"], epoch: "3" },
        { winners: [CAROL, BOB, ALICE], values: ["4", "3", "2"], epoch: "5" },
        { winners: [ALICE, CAROL, BOB], values: ["300", "240", "60"], epoch: "2" },
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

describe("ArenaSimplePodiumSection (issue #113)", () => {
  it("shows live Last Buy seconds from indexer winnerBuySec", () => {
    const html = renderSimplePodiums({
      podiumRows: [
        {
          winners: [ALICE, BOB, CAROL],
          values: ["3", "2", "1"],
          winnerBuySec: ["1700000000", "1699999990", "1699999980"],
        },
        { winners: [BOB, ALICE, CAROL], values: ["1200", "900", "400"] },
        { winners: [CAROL, BOB, ALICE], values: ["4", "3", "2"] },
        { winners: [ALICE, CAROL, BOB], values: ["300", "240", "60"] },
      ],
      podiumNowUnixSec: 1_700_000_020,
    });
    expect(html).toContain("20s");
    expect(html).toContain("30s");
    expect(html).toContain("40s");
  });

  it("renders help buttons instead of inline podium rule blurbs", () => {
    const html = renderSimplePodiums();
    expect(html).toContain('data-testid="arena-podium-help-0"');
    expect(html).toContain('data-testid="arena-podium-help-1"');
    expect(html).toContain('data-testid="arena-podium-help-2"');
    expect(html).toContain('data-testid="arena-podium-help-3"');
    expect(html).not.toContain("Top 3 most recent buyers win when this timer hits zero.");
    expect(html).not.toContain("Most total Last Buy time added wins when this timer hits zero.");
    expect(html).not.toContain("Highest defended-streak count wins when this timer hits zero.");
  });

  it("renders all four canonical podium categories and three placements", () => {
    const html = renderSimplePodiums();
    expect(html).toContain('data-testid="arena-simple-podiums"');
    expect(html).toContain("Last Buy");
    expect(html).toContain("WarBow");
    const lastBuyPos = html.indexOf("Last Buy");
    const timeBoosterPos = html.indexOf("Time Booster");
    const defendedPos = html.indexOf("Defended Streak");
    const warbowPos = html.indexOf("WarBow");
    expect(lastBuyPos).toBeLessThan(timeBoosterPos);
    expect(timeBoosterPos).toBeLessThan(defendedPos);
    expect(defendedPos).toBeLessThan(warbowPos);
    expect(html).toContain('data-testid="arena-podium-epoch-0"');
    expect(html).toContain("Epoch");
    expect(html).toContain("<strong>12</strong>");
    expect(html).toContain("Defended Streak");
    expect(html).toContain("Time Booster");
    expect(html.match(/class="ranking-list__item/g)?.length).toBe(12);
    expect(html).toContain("/art/icons/arena-podium-rank-first.png");
    expect(html).toContain("/art/icons/arena-podium-rank-second.png");
    expect(html).toContain("/art/icons/arena-podium-rank-third.png");
    expect(html).toContain("1st prize");
    expect(html).toContain("DOUB");
    expect(html).toContain("≈ $1.57 USD");
    expect(html).toContain("1.6");
    expect(html).not.toContain("predicted leader");
    expect(html).not.toContain("Indexer-backed snapshot");
    expect(html.indexOf("1.6")).toBeLessThan(html.indexOf("0x1111"));
    expect(html).toContain("—");
    expect(html).toContain("1.2k BP");
    expect(html).toContain("900 BP");
    expect(html).toContain("4 sequential buys");
    expect(html).toContain("+05:00");
    expect(html).toContain("+04:00");
    expect(html).toContain("+01:00");
    expect(html).toMatch(/address-inline__label">111111</);
    expect(html).not.toMatch(/address-inline__label">0x/);
  });

  it("highlights placements that match the connected wallet", () => {
    const html = renderSimplePodiums({ address: ALICE });
    expect(html).toContain("ranking-list__item--you");
  });

  it("does not lock secondary podiums when wallet is not connected (#334)", () => {
    const html = renderSimplePodiums({ address: undefined });
    expect(html).not.toContain('data-testid="arena-podium-lock-0"');
    expect(html).not.toContain('data-testid="arena-podium-lock-1"');
    expect(html).not.toContain('data-testid="arena-podium-lock-2"');
    expect(html).not.toContain('data-testid="arena-podium-lock-3"');
    expect(html).not.toContain("Connect wallet to buy CHARM.");
  });

  it("locks only the immediate next unlock tier for connected wallets (#334)", () => {
    const html = renderSimplePodiums({ address: ALICE, playerLevel: 1 });
    expect(html).not.toContain('data-testid="arena-podium-lock-0"');
    expect(html).toContain('data-testid="arena-podium-lock-3"');
    expect(html).not.toContain('data-testid="arena-podium-lock-2"');
    expect(html).not.toContain('data-testid="arena-podium-lock-1"');
    expect(html).toContain("LEVEL 2");
    expect(html).toContain("Time Booster");
    expect(html).not.toContain("LEVEL 3");
    expect(html).not.toContain("LEVEL 4");
    expect(html).not.toContain("Connect wallet to buy CHARM.");
  });

  it("wires onOpenWalletProfile to podium winner addresses (#258)", () => {
    const html = renderSimplePodiums({ onOpenWalletProfile: () => {} });
    expect(html).toContain("address-inline__profile-btn");
    expect(html).not.toContain("cursor-external-link");
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
    expect(html).toContain("&lt; 15MIN");
  });

  it("shows a neutral em dash for empty winner slots (no wallet-connect wording)", () => {
    const html = renderSimplePodiums({
      podiumRows: [{ winners: [ZERO, ZERO, ZERO], values: ["0", "0", "0"] }],
    });
    expect(html).toContain("—");
    expect(html).not.toContain("Awaiting wallet");
    expect(html).toContain("1.6");
    expect(html).toContain("DOUB");
  });

  it("shows muted unavailable copy when prize preview is explicitly null (legacy indexer)", () => {
    const html = renderSimplePodiums({ podiumPayoutPreview: null });
    expect(html).toContain("Prizes unavailable");
    expect(html).not.toContain("Prizes loading");
  });

  it("omits zero USD equivalent when podium prize preview is zero", () => {
    const html = renderSimplePodiums({
      podiumPayoutPreview: [
        { places: ["0", "0", "0"] },
        { places: ["0", "0", "0"] },
        { places: ["0", "0", "0"] },
        { places: ["0", "0", "0"] },
      ],
    });
    expect(html).toContain("0");
    expect(html).not.toContain("≈ $0 USD");
    expect(html).not.toContain("Prizes loading");
  });
});

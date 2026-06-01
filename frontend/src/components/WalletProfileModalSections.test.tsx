// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArenaWalletStats } from "@/lib/indexerApi";
import {
  WalletProfileFunFactsSection,
  WalletProfileOverviewSection,
  WalletProfilePodiumWinsSection,
  WalletProfileReferralsSection,
  WalletProfileSpendingSection,
  WalletProfileStatsBody,
  WalletProfileWarbowSection,
  WalletProfileXpSection,
} from "./WalletProfileModalSections";

const mockStats: ArenaWalletStats = {
  address: "0xdddddddddddddddddddddddddddddddddddddddd",
  epochs_participated: 2,
  buy_count: 5,
  total_spent_doub: "5000000000000000000",
  average_buy_doub: "1000000000000000000",
  max_single_buy_doub: "2000000000000000000",
  first_buy_at: "1700000000",
  xp: "1200",
  level: "3",
  prizes_won: [
    { podium: "last_buy", epoch: "1", rank: 1, amount_doub: "4000000000000000000" },
  ],
  total_won_doub: "4000000000000000000",
  highest_scores: [
    { podium: "warbow", epoch: "1", score: "750", rank: 2 },
  ],
  warbow_steals: 3,
  warbow_guards: 1,
  cred_claimed: "150000000000000000000",
  referral_cred_earned: "5000000000000000000",
  longest_defended_streak: "4",
  podium_win_rate: "0.5000",
  rank_distribution: { "1": "1", "2": "0", "3": "0" },
};

describe("WalletProfileModalSections (GitLab #258)", () => {
  it("renders all required section headings", () => {
    const html = renderToStaticMarkup(
      createElement(WalletProfileStatsBody, { data: mockStats }),
    );
    expect(html).toContain("Overview");
    expect(html).toContain("Podium wins");
    expect(html).toContain("Spending");
    expect(html).toContain("XP / Level");
    expect(html).toContain("WarBow");
    expect(html).toContain("Referrals");
    expect(html).toContain("Fun facts");
  });

  it("renders overview buy count and win rate", () => {
    const html = renderToStaticMarkup(createElement(WalletProfileOverviewSection, { data: mockStats }));
    expect(html).toContain("5");
    expect(html).toContain("50.0%");
  });

  it("renders podium prize rows", () => {
    const html = renderToStaticMarkup(createElement(WalletProfilePodiumWinsSection, { data: mockStats }));
    expect(html).toContain("Last Buy");
    expect(html).toContain("1st");
  });

  it("renders spending totals", () => {
    const html = renderToStaticMarkup(createElement(WalletProfileSpendingSection, { data: mockStats }));
    expect(html).toContain("Total spent");
    expect(html).toContain("Largest buy");
  });

  it("renders XP and level", () => {
    const html = renderToStaticMarkup(createElement(WalletProfileXpSection, { data: mockStats }));
    expect(html).toContain("Level");
    expect(html).toContain("3");
    expect(html).toContain("1,200");
  });

  it("renders WarBow steals and guards", () => {
    const html = renderToStaticMarkup(createElement(WalletProfileWarbowSection, { data: mockStats }));
    expect(html).toContain("Steals");
    expect(html).toContain("Guards");
  });

  it("renders referral CRED", () => {
    const html = renderToStaticMarkup(createElement(WalletProfileReferralsSection, { data: mockStats }));
    expect(html).toContain("CRED earned from referrals");
  });

  it("renders fun facts peak scores", () => {
    const html = renderToStaticMarkup(createElement(WalletProfileFunFactsSection, { data: mockStats }));
    expect(html).toContain("Longest defended streak");
    expect(html).toContain("750 BP");
  });
});

// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ArenaWalletStats } from "@/lib/indexerApi";
import {
  WalletProfileBalancesSection,
  WalletProfileFunFactsSection,
  WalletProfileLevelHistorySection,
  WalletProfileOverviewSection,
  WalletProfilePodiumWinsSection,
  WalletProfileReferralsSection,
  WalletProfileSpendingSection,
  WalletProfileStatsBody,
  WalletProfileWarbowSection,
  WalletProfileXpSection,
} from "./WalletProfileModalSections";
import type { WalletProfileBalancesSnapshot } from "@/hooks/useWalletProfileBalances";

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
  level_history: [
    { level: "1", reached_at: "2023-11-14T22:13:20Z" },
    { level: "2", reached_at: "2023-11-15T10:00:00Z" },
    { level: "3", reached_at: null },
    { level: "4", reached_at: null },
    { level: "5", reached_at: null },
  ],
};

const mockBalances: WalletProfileBalancesSnapshot = {
  charmWad: 5_000_000_000_000_000_000n,
  credWei: 150_000_000_000_000_000_000n,
  doubWei: 1_038_000_000_000_000_000_000n,
  ethWei: 10_000_000_000_000_000_000n,
  usdmWei: 500_000_000_000_000_000_000n,
  showUsdm: true,
  isLoading: false,
};

describe("WalletProfileModalSections (GitLab #258)", () => {
  it("renders wallet balances for CHARM, CRED, DOUB, ETH, and USDM", () => {
    const html = renderToStaticMarkup(
      createElement(WalletProfileBalancesSection, { balances: mockBalances }),
    );
    expect(html).toContain("Wallet balances");
    expect(html).toContain("CHARM");
    expect(html).toContain("CRED");
    expect(html).toContain("DOUB");
    expect(html).toContain("ETH");
    expect(html).toContain("USDM");
  });

  it("renders all required section headings", () => {
    const html = renderToStaticMarkup(
      createElement(WalletProfileStatsBody, { data: mockStats }),
    );
    expect(html).toContain("Overview");
    expect(html).toContain("Podium wins");
    expect(html).toContain("Spending");
    expect(html).toContain("XP / Level");
    expect(html).toContain("Level history");
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

  it("renders level history with local timestamps and placeholders (#336)", () => {
    const html = renderToStaticMarkup(
      createElement(WalletProfileLevelHistorySection, { data: mockStats }),
    );
    expect(html).toContain("Level history");
    expect(html).toContain("Level 1 · Last Buy");
    expect(html).toContain("Level 2 · Booster");
    expect(html).toContain("Level 3 · Streak");
    expect(html).not.toContain("Level 3 · Level 3");
    expect(html).toContain("—");
    const expectedL1 = new Date("2023-11-14T22:13:20Z").toLocaleString();
    expect(html).toContain(expectedL1);
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

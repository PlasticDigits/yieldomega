// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AddressInline } from "./AddressInline";
import { WalletProfileModal } from "./WalletProfileModal";

vi.mock("@/hooks/useWalletStats", () => ({
  useWalletStats: () => ({
    data: {
      address: "0xdddddddddddddddddddddddddddddddddddddddd",
      buy_count: 1,
      epochs_participated: 1,
      total_spent_doub: "0",
      average_buy_doub: "0",
      max_single_buy_doub: "0",
      xp: "0",
      level: "1",
      prizes_won: [],
      total_won_doub: "0",
      highest_scores: [],
      warbow_steals: 0,
      warbow_guards: 0,
      cred_claimed: "0",
      referral_cred_earned: "0",
      longest_defended_streak: "0",
      podium_win_rate: "0",
      rank_distribution: {},
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useWalletProfileBalances", () => ({
  useWalletProfileBalances: () => ({
    charmWad: 0n,
    credWei: 0n,
    doubWei: 0n,
    ethWei: 0n,
    usdmWei: 0n,
    showUsdm: false,
    isLoading: false,
  }),
}));

vi.mock("@/lib/addresses", () => ({
  indexerBaseUrl: () => "http://127.0.0.1:3100",
}));

vi.mock("@/lib/explorer", () => ({
  explorerAddressUrl: (addr: string) => `https://explorer.example/${addr}`,
}));

describe("WalletProfileModal (GitLab #321)", () => {
  it("renders dialog chrome with labelled title and close control", () => {
    const html = renderToStaticMarkup(
      createElement(WalletProfileModal, {
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        onClose: () => {},
      }),
    );
    expect(html).toContain("<dialog");
    expect(html).toContain('data-testid="wallet-profile-modal"');
    expect(html).toContain("Participant profile");
    expect(html).toContain('aria-label="Close dialog"');
    expect(html).toContain("0xdddddddddddddddddddddddddddddddddddddddd");
    expect(html).toContain('data-testid="wallet-profile-level"');
    expect(html).toContain("Lv 1");
  });

  it("restores focus to the opener when the modal closes", () => {
    const src = readFileSync(resolve(__dirname, "WalletProfileModal.tsx"), "utf8");
    expect(src).toContain("returnFocusRef");
    expect(src).toContain("returnFocusRef.current?.focus?.()");
  });

  it("escapes malicious address text in explorer links", () => {
    const xss = '<img src=x onerror=alert(1)>@evil.test';
    const html = renderToStaticMarkup(
      createElement(WalletProfileModal, {
        address: xss,
        onClose: () => {},
      }),
    );
    expect(html).toContain(
      'href="https://explorer.example/&lt;img src=x onerror=alert(1)&gt;@evil.test"',
    );
    expect(html).toContain('<p class="wallet-profile-modal__address"><span class="mono">—</span></p>');
  });

  it("does not render attacker-controlled HTML in address labels", () => {
    const xssAttempt = "0x<script>alert(1)</script>0000000000000000000000";
    const html = renderToStaticMarkup(
      createElement(AddressInline, { address: xssAttempt, explorer: false }),
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("—");
  });
});

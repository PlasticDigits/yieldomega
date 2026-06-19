// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { WhileYouWereAwayModal } from "./WhileYouWereAwayModal";
import type { ArenaSessionSummary } from "@/lib/indexerApi";

vi.mock("@/components/AddressInline", () => ({
  AddressInline: ({ address }: { address: string }) => createElement("span", null, address),
}));

vi.mock("@/components/AmountDisplay", () => ({
  AmountDisplay: ({ raw }: { raw: string }) => createElement("span", null, raw),
}));

const ALICE = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const summary: ArenaSessionSummary = {
  since_ms: "1700000000000",
  elapsed_ms: "3600000",
  total_buys: "12",
  unique_players: "4",
  podium_updates: "1",
  podium_epochs_ended: [
    {
      podium: "last_buy",
      category: 0,
      epoch: "3",
      pool_paid_doub_wad: "700",
      winners: [
        { rank: 1, address: ALICE, prize_doub_wad: "400" },
        { rank: 2, address: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", prize_doub_wad: "200" },
        { rank: 3, address: null, prize_doub_wad: "100" },
      ],
    },
  ],
  wallet_summary: {
    address: ALICE,
    buy_count: "2",
    wins: "1",
    rank_at_since: "5",
    rank_now: "3",
    rank_delta: "2",
  },
};

describe("WhileYouWereAwayModal (#338)", () => {
  it("renders approved summary fields and congratulations for connected winner", () => {
    const html = renderToStaticMarkup(
      createElement(WhileYouWereAwayModal, {
        summary,
        connectedWallet: ALICE,
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('data-testid="while-you-were-away-modal"');
    expect(html).toContain("While You Were Away");
    expect(html).toContain('data-testid="wywa-elapsed"');
    expect(html).toContain("12");
    expect(html).toContain('data-testid="wywa-congrats"');
    expect(html).toContain('data-testid="wywa-rank-delta"');
    expect(html).toContain("Back to play");
  });

  it("omits wallet rank and congratulations when wallet is disconnected (sad path)", () => {
    const html = renderToStaticMarkup(
      createElement(WhileYouWereAwayModal, {
        summary,
        connectedWallet: undefined,
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('data-testid="while-you-were-away-modal"');
    expect(html).not.toContain('data-testid="wywa-rank-delta"');
    expect(html).not.toContain('data-testid="wywa-congrats"');
    expect(html).not.toContain("Your wallet");
  });

  it("omits congratulations when connected wallet did not podium-win (sad path)", () => {
    const html = renderToStaticMarkup(
      createElement(WhileYouWereAwayModal, {
        summary,
        connectedWallet: "0xcccccccccccccccccccccccccccccccccccccccc",
        onDismiss: () => {},
      }),
    );

    expect(html).toContain('data-testid="wywa-rank-delta"');
    expect(html).not.toContain('data-testid="wywa-congrats"');
  });
});

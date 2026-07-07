// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ArenaBuyResultSharePopover } from "./ArenaBuyResultSharePopover";
import type { ArenaBuyShareSummary } from "./arenaBuyShareSummary";

vi.mock("motion/react", () => ({
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) =>
      createElement("div", props, children),
  },
  useReducedMotion: () => true,
}));

const VALID_TX_HASH = `0x${"a".repeat(64)}` as const;

const sampleSummary: ArenaBuyShareSummary = {
  headline: "⏱ +2m · 🏆 Last Buyer · +750 BP",
  rows: [
    { icon: "⏱", label: "Timer", value: "+2m", tone: "timer" },
    { icon: "🏆", label: "Rank", value: "Last Buyer", tone: "rank" },
    { icon: "⚔", label: "Battle points", value: "+750 BP (Base + Reset)", tone: "warbow" },
  ],
  txHash: VALID_TX_HASH,
  shareText: "Yield Omega — Time Arena buy\n⏱ +2m · 🏆 Last Buyer",
  pending: false,
};

describe("ArenaBuyResultSharePopover (#365)", () => {
  it("renders dialog with headline, rows, and share actions", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaBuyResultSharePopover, {
        summary: sampleSummary,
        onDismiss: () => {},
        reduceMotion: true,
      }),
    );
    expect(html).toContain('data-testid="arena-buy-result-share-popover"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('data-testid="arena-buy-result-share-headline"');
    expect(html).toContain("+2m");
    expect(html).toContain('data-testid="arena-buy-result-share-row"');
    expect(html).toContain('data-testid="arena-buy-result-share-copy-summary"');
    expect(html).toContain('data-testid="arena-buy-result-share-copy-tx"');
    expect(html).toContain('data-testid="arena-buy-result-share-close"');
  });

  it("shows pending label for preview snapshots", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaBuyResultSharePopover, {
        summary: { ...sampleSummary, pending: true },
        onDismiss: () => {},
        reduceMotion: true,
      }),
    );
    expect(html).toContain('data-testid="arena-buy-result-share-pending"');
    expect(html).toContain("Confirming onchain");
  });

  it("renders nothing when summary is null (sad path)", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaBuyResultSharePopover, {
        summary: null,
        onDismiss: () => {},
        reduceMotion: true,
      }),
    );
    expect(html).toBe("");
  });
});

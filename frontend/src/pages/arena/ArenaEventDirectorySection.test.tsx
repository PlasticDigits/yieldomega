// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ArenaEventDirectorySection } from "@/pages/arena/ArenaEventDirectorySection";

vi.mock("@/hooks/useIndexerConnectivity", () => ({
  useIndexerConnectivity: () => ({ isOffline: false }),
}));

vi.mock("@/pages/arena/useArenaEventDirectory", () => ({
  useArenaEventDirectory: () => ({
    items: [
      {
        id: "podium_settlement:0xabc:1",
        kind: "podium_settlement",
        slug: "warbow-epoch-2",
        title: "WarBow Epoch 2 — 0xabcd…ef01 wins 1st",
        subtitle: "WarBow podium settlement",
        block_timestamp: "1700000000",
        podium: "warbow",
        category: 3,
        epoch: "2",
        tx_hash: "0xabc",
        block_number: "100",
        log_index: 1,
      },
    ],
    loading: false,
    loadingMore: false,
    indexerNote: null,
    nextOffset: null,
    loadMore: () => undefined,
    refresh: () => undefined,
  }),
}));

describe("ArenaEventDirectorySection (#364)", () => {
  it("renders filter chips and encoded permanent event links", () => {
    const html = renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: ["/audit"] }, createElement(ArenaEventDirectorySection)),
    );
    expect(html).toContain('data-testid="arena-event-directory"');
    expect(html).toContain("Event directory");
    expect(html).toContain("Podium settlements");
    expect(html).toContain("Last Buy epochs");
    expect(html).toContain("/audit/events/podium_settlement%3A0xabc%3A1");
    expect(html).toContain("WarBow Epoch 2");
  });
});

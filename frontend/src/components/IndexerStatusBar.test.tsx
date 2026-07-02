// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IndexerStatusBar } from "./IndexerStatusBar";

const mockIndexerConnectivity = vi.fn();

vi.mock("@/hooks/useIndexerConnectivity", () => ({
  useIndexerConnectivity: () => mockIndexerConnectivity(),
}));

vi.mock("@/lib/addresses", () => ({
  indexerBaseUrl: () => "http://127.0.0.1:3100",
}));

describe("IndexerStatusBar", () => {
  it("renders a tone bead instead of the legacy indexer pictogram", () => {
    mockIndexerConnectivity.mockReturnValue({
      isOffline: false,
      lastOkBanner: {
        schemaVersion: "2.20.0",
        maxIndexedBlockDisplay: "20,164,450",
      },
    });
    const html = renderToStaticMarkup(createElement(IndexerStatusBar));
    expect(html).toContain("indexer-status__bead");
    expect(html).toContain("indexer-status--success");
    expect(html).not.toContain("status-indexer-ok.png");
    expect(html).not.toContain("<img");
  });

  it("maps offline and connecting states to error and info beads", () => {
    mockIndexerConnectivity.mockReturnValue({
      isOffline: true,
      lastOkBanner: null,
    });
    const offline = renderToStaticMarkup(createElement(IndexerStatusBar));
    expect(offline).toContain("indexer-status--error");

    mockIndexerConnectivity.mockReturnValue({
      isOffline: false,
      lastOkBanner: null,
    });
    const connecting = renderToStaticMarkup(createElement(IndexerStatusBar));
    expect(connecting).toContain("indexer-status--info");
  });
});

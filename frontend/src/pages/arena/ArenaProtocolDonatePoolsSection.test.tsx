// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ArenaPodiumPoolDonations } from "@/lib/indexerApi";

const mockHook = vi.fn();

vi.mock("./useArenaProtocolDonatePools", () => ({
  useArenaProtocolDonatePools: () => mockHook(),
}));

vi.mock("@/pages/arena/ArenaProtocolDataContext", () => ({
  useArenaProtocolData: () => ({
    latchedAcceptedAssetAddr: "0x" + "d".repeat(40),
  }),
}));

vi.mock("@/lib/addresses", () => ({
  indexerBaseUrl: () => "http://127.0.0.1:3100",
  addresses: { timeArena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" },
}));

vi.mock("@/components/ChainMismatchWriteBarrier", () => ({
  ChainMismatchWriteBarrier: ({ children }: { children: ReactNode }) => children,
}));

import { ArenaProtocolDonatePoolsSection, DONATE_DISCLOSURE } from "./ArenaProtocolDonatePoolsSection";

const baseHookState = {
  timeArena: "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" as const,
  data: null as ArenaPodiumPoolDonations | null,
  initialLoading: false,
  refreshing: false,
  indexerErr: null as string | null,
  loadIndexer: () => {},
  amountInput: "",
  setAmountInput: () => {},
  parsedAmountWei: null,
  doubBalanceWei: undefined,
  submitting: false,
  writeErr: null as string | null,
  writeOk: null as string | null,
  donate: async () => {},
  isConnected: false,
};

describe("ArenaProtocolDonatePoolsSection (GitLab #262)", () => {
  it("exposes required no-benefit disclosure copy", () => {
    expect(DONATE_DISCLOSURE).toContain("does not provide you with any benefit");
  });

  it("renders disclosure and empty placeholders when indexer data is unavailable", () => {
    mockHook.mockReturnValue({
      ...baseHookState,
      indexerErr: "Donation history is unavailable right now.",
    });
    const html = renderToStaticMarkup(
      createElement(ArenaProtocolDonatePoolsSection, { isOffline: false }),
    );
    expect(html).toContain(DONATE_DISCLOSURE);
    expect(html).toContain("donate-pools-console");
    expect(html).toContain("100% to active + seed prize vaults.");
    expect(html).toContain(">Donate</button>");
    expect(html).toContain("empty-data-placeholder");
    expect(html).toContain("Donation history is unavailable right now.");
    expect(html).not.toContain('data-testid="arena-protocol-donate-pools-recent"');
  });

  it("shows offline copy with placeholders when indexer read fails", () => {
    mockHook.mockReturnValue({
      ...baseHookState,
      indexerErr: "Could not load donation history.",
    });
    const html = renderToStaticMarkup(
      createElement(ArenaProtocolDonatePoolsSection, { isOffline: true }),
    );
    expect(html).toContain("Indexer offline");
    expect(html).toContain('data-testid="arena-protocol-donate-pools-total"');
    expect(html).toContain("empty-data-placeholder");
    expect(html).not.toContain('amount-triple__value">0</span>');
  });
});

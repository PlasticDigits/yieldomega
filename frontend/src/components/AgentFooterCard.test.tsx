// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/IndexerStatusBar", () => ({
  IndexerStatusBar: () => createElement("div", { "data-testid": "indexer-status" }),
}));

vi.mock("@/components/ReferralsFooterPendingPill", () => ({
  ReferralsFooterPendingPill: () => createElement("div", { "data-testid": "referrals-pill" }),
}));

vi.mock("@/components/FeeTransparency", () => ({
  FeeTransparency: () => createElement("div", { "data-testid": "fee-transparency" }),
}));

vi.mock("@/lib/addresses", () => ({
  addresses: {
    timeArena: "0x1111111111111111111111111111111111111111",
    podiumVaults: "0x2222222222222222222222222222222222222222",
    referralRegistry: "0x3333333333333333333333333333333333333333",
  },
  governanceUrl: () => undefined,
  indexerBaseUrl: () => "http://127.0.0.1:3100",
}));

vi.mock("@/lib/chain", () => ({
  resolveChainRpcConfig: () => ({ id: 31337 }),
}));

import { AgentFooterCard } from "@/components/AgentFooterCard";

describe("AgentFooterCard", () => {
  it("documents current play skills, stack scripts, and indexer routes", () => {
    const html = renderToStaticMarkup(createElement(AgentFooterCard));

    expect(html).toContain("play-time-arena-warbow");
    expect(html).toContain("Agent card");
    expect(html).toContain("accordion-panel");
    expect(html).not.toContain("stub until #252");
    expect(html).toContain("AGENTS.md");
    expect(html).toContain("bootstrap-cloud-install.sh");
    expect(html).toContain("verify-podium-live-anvil.sh");
    expect(html).toContain("verify-evm-dev-wallet-seed-anvil.sh");
    expect(html).toContain("GET /v1/arena/warbow/pending-revenge/{address}");
    expect(html).toContain("buy_routing");
    expect(html).toContain("2.16.0");
    expect(html).toContain("indexer-first");
    expect(html).toContain("/arena/protocol");
    expect(html).toContain("VITE_TIME_ARENA_ADDRESS");
    expect(html).toContain("gitlab.com/PlasticDigits/yieldomega");
  });
});

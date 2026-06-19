// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: undefined }),
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useLocation: () => ({ pathname: "/" }),
  };
});

vi.mock("@/pages/arena/ArenaSimplePage", () => ({
  ArenaSimplePage: () => createElement("div", { "data-testid": "arena-simple-page-stub" }),
}));

vi.mock("@/components/WalletProfileModal", () => ({
  WalletProfileModal: () => null,
}));

vi.mock("@/hooks/useWhileYouWereAway", () => ({
  useWhileYouWereAway: () => ({ state: null, dismiss: () => {} }),
}));

import { TimeArenaPage } from "./TimeArenaPage";

describe("TimeArenaPage (#331 visual wiring)", () => {
  it("mounts play surface and omits away modal when hook state is null (indexer-off / no activity sad path)", () => {
    const html = renderToStaticMarkup(createElement(TimeArenaPage));
    expect(html).toContain('data-testid="time-arena-page-mounted"');
    expect(html).toContain('data-testid="arena-simple-page-stub"');
    expect(html).not.toContain('data-testid="while-you-were-away-modal"');
  });
});

describe("TimeArenaPage while-you-were-away wiring (#338)", () => {
  const src = readFileSync(resolve(__dirname, "TimeArenaPage.tsx"), "utf8");

  it("gates modal on hook state and passes connected wallet", () => {
    expect(src).toContain("useWhileYouWereAway");
    expect(src).toContain("wywaState ?");
    expect(src).toContain("WhileYouWereAwayModal");
    expect(src).toContain("connectedWallet={address}");
  });
});

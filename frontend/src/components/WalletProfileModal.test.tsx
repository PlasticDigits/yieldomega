// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AddressInline } from "./AddressInline";
import { WalletProfileModal } from "./WalletProfileModal";

vi.mock("@/hooks/useWalletStats", () => ({
  useWalletStats: () => ({ data: undefined, isLoading: false, isError: false }),
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

describe("WalletProfileModal a11y and abuse guards (GitLab #321)", () => {
  it("uses native dialog semantics with labelled title and close control", () => {
    const html = renderToStaticMarkup(
      createElement(WalletProfileModal, {
        address: "0xdddddddddddddddddddddddddddddddddddddddd",
        onClose: () => {},
      }),
    );
    expect(html).toContain("<dialog");
    expect(html).toContain('data-testid="wallet-profile-modal"');
    expect(html).toContain('aria-label="Close dialog"');
    expect(html).toContain("Participant profile");
  });

  it("restores focus to the opener when the modal closes", () => {
    const src = readFileSync(resolve(__dirname, "WalletProfileModal.tsx"), "utf8");
    expect(src).toContain("returnFocusRef");
    expect(src).toContain("returnFocusRef.current?.focus?.()");
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

// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WarbowClaimFlagButton } from "./WarbowClaimFlagButton";

function renderButton(overrides: Partial<Parameters<typeof WarbowClaimFlagButton>[0]> = {}) {
  const props: Parameters<typeof WarbowClaimFlagButton>[0] = {
    canClaimWarBowFlag: false,
    ledgerNowSec: 1_000_000,
    flagSilenceEndSec: 1_000_200n,
    saleActive: true,
    arenaPaused: false,
    isConnected: true,
    isWriting: false,
    onClaim: () => {},
    ...overrides,
  };
  return renderToStaticMarkup(createElement(WarbowClaimFlagButton, props));
}

describe("WarbowClaimFlagButton", () => {
  it("renders countdown label while silence is active", () => {
    const html = renderButton({ testId: "simple-claim" });
    expect(html).toContain("Claim flag 00:03:20");
    expect(html).toMatch(/disabled/);
  });

  it("renders enabled claim label after silence", () => {
    const html = renderButton({
      canClaimWarBowFlag: true,
      ledgerNowSec: 1_000_400,
      flagSilenceEndSec: 1_000_200n,
    });
    expect(html).toContain(">Claim flag<");
    expect(html).not.toMatch(/disabled/);
  });
});

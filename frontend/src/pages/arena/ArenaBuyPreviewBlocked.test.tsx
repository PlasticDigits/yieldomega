// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ArenaBuyPreviewBlocked } from "./ArenaBuyPreviewBlocked";

describe("ArenaBuyPreviewBlocked", () => {
  it("renders compact cyberminimalist insufficient balance copy", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaBuyPreviewBlocked, {
        testId: "arena-simple-buy-preview-insufficient-cl8y",
        headline: "Insufficient DOUB",
        needLabel: "30.01k DOUB",
        haveLabel: "0 DOUB",
      }),
    );
    expect(html).toContain('data-testid="arena-simple-buy-preview-insufficient-cl8y"');
    expect(html).toContain("arena-simple__buy-preview-blocked-card");
    expect(html).toContain("Insufficient DOUB");
    expect(html).toContain("Need <strong>30.01k DOUB</strong>");
    expect(html).toContain("Have <strong>0 DOUB</strong>");
    expect(html).not.toContain("Not enough DOUB in your wallet to buy");
    expect(html).not.toContain("The live minimum is");
  });

  it("keeps full context in aria-label when detail is provided", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaBuyPreviewBlocked, {
        testId: "arena-simple-buy-preview-insufficient-cred",
        headline: "Insufficient CRED",
        needLabel: "1.5 CRED",
        haveLabel: "0 CRED",
        detail: "Not enough Play CRED to burn for this CHARM. Need 1.5 CRED; have 0 CRED.",
      }),
    );
    expect(html).toContain('aria-label="Not enough Play CRED to burn for this CHARM. Need 1.5 CRED; have 0 CRED."');
  });
});

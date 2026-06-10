// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AddressInline } from "@/components/AddressInline";
import { EmptyDataPlaceholder } from "@/components/EmptyDataPlaceholder";
import { StatusMessage } from "@/components/ui/StatusMessage";

describe("shared UX primitives (GitLab #294)", () => {
  it("renders address rows as blockie plus last six hex digits by default", () => {
    const html = renderToStaticMarkup(
      createElement(AddressInline, {
        address: "0x1234567890abcdef1234567890abcdef1234abcd",
        explorer: false,
      }),
    );

    expect(html).toContain("address-inline__blockie");
    expect(html).toContain("address-inline__label");
    expect(html).toContain("<span class=\"mono address-inline__label\">34abcd</span>");
    expect(html).not.toContain("…");
  });

  it("keeps profile address rows as an in-app action", () => {
    const html = renderToStaticMarkup(
      createElement(AddressInline, {
        address: "0xabcdefabcdefabcdefabcdefabcdefabcdef9876",
        onOpenProfile: () => undefined,
      }),
    );

    expect(html).toContain("address-inline__profile-btn");
    expect(html).toContain("Open wallet profile for 0xabcdefabcdefabcdefabcdefabcdefabcdef9876");
    expect(html).not.toContain("target=\"_blank\"");
  });

  it("lets status primitives carry route-level test and ARIA attributes", () => {
    const html = renderToStaticMarkup(
      createElement(StatusMessage, {
        variant: "error",
        "data-testid": "primitive-status",
        role: "alert",
        children: "Blocked",
      }),
    );

    expect(html).toContain("data-testid=\"primitive-status\"");
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("status-message");
    expect(html).toContain("status-message--error");
    expect(html).toContain("error-text");
  });

  it("keeps empty placeholders phrasing-safe and intentionally announced", () => {
    const html = renderToStaticMarkup(
      createElement("p", null, createElement(EmptyDataPlaceholder, null, "No indexed rows yet.")),
    );

    expect(html).toMatch(/^<p[\s>]/);
    expect(html).not.toMatch(/<p[^>]*>[\s\S]*<div\b/i);
    expect(html).toContain("empty-data-placeholder");
    expect(html).toContain("role=\"status\"");
  });
});

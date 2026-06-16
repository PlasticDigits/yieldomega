// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AccordionPanel } from "@/components/ui/AccordionPanel";

describe("AccordionPanel", () => {
  it("renders audit-style glass accordion chrome", () => {
    const html = renderToStaticMarkup(
      createElement(
        AccordionPanel,
        {
          badgeLabel: "Protocol detail",
          badgeTone: "info",
          title: "Raw contract context",
          lede: "Open for getter mirrors.",
          children: createElement("p", null, "Body copy"),
        },
      ),
    );

    expect(html).toContain('class="data-panel accordion-panel"');
    expect(html).toContain("Raw contract context");
    expect(html).toContain("accordion-panel__content");
    expect(html).toContain("Body copy");
  });
});

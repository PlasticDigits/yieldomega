// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { ArenaSubnav } from "./ArenaSubnav";

function renderSubnav(active: "simple" | "protocol", route: string): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [route] },
      createElement(ArenaSubnav, { active }),
    ),
  );
}

describe("ArenaSubnav (Arena v2 #266)", () => {
  it("renders BUY and AUDIT tabs in order", () => {
    const html = renderSubnav("simple", "/arena");
    const buyIdx = html.indexOf("BUY");
    const auditIdx = html.indexOf("AUDIT");
    expect(buyIdx).toBeGreaterThan(-1);
    expect(auditIdx).toBeGreaterThan(buyIdx);
  });

  it("links to canonical /arena routes", () => {
    const html = renderSubnav("simple", "/arena");
    expect(html).toContain('href="/arena"');
    expect(html).toContain('href="/arena/protocol"');
  });

  it("marks the active tab on the matching link", () => {
    const simple = renderSubnav("simple", "/arena");
    expect(simple).toContain('href="/arena"');
    expect(simple).toContain("arena-subnav__tab--active");
    const protocol = renderSubnav("protocol", "/arena/protocol");
    expect(protocol).toContain('href="/arena/protocol"');
  });

  it("renders sub-nav pictograms for BUY and AUDIT", () => {
    const html = renderSubnav("simple", "/arena");
    expect(html).toContain('src="/art/icons/nav-simple.png"');
    expect(html).toContain('src="/art/icons/nav-protocol.png"');
  });

  it("keeps mechanics in tooltips instead of default visible info copy", () => {
    const html = renderSubnav("simple", "/arena");
    expect(html).toContain('title="Buy CHARM with DOUB or Play CRED and compete on Time Arena podiums."');
    expect(html).toContain('aria-label="BUY: Buy CHARM with DOUB or Play CRED and compete on Time Arena podiums."');
    expect(html).not.toContain("ABOUT TIME ARENA");
  });
});

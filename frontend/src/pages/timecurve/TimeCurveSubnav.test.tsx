// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TimeCurveSubnav } from "./TimeCurveSubnav";

function renderSubnav(active: "simple" | "arena" | "protocol", route: string): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [route] },
      createElement(TimeCurveSubnav, { active }),
    ),
  );
}

describe("TimeCurveSubnav (issue #40 progressive disclosure)", () => {
  it("renders the three TimeCurve tabs in order", () => {
    const html = renderSubnav("simple", "/timecurve");
    const buyIdx = html.indexOf("BUY");
    const arenaIdx = html.indexOf("ARENA");
    const auditIdx = html.indexOf("AUDIT");
    expect(buyIdx).toBeGreaterThan(-1);
    expect(arenaIdx).toBeGreaterThan(buyIdx);
    expect(auditIdx).toBeGreaterThan(arenaIdx);
  });

  it("marks the active tab via aria-current on the matching link", () => {
    const simple = renderSubnav("simple", "/timecurve");
    expect(simple).toMatch(
      /aria-current="page"[\s\S]*?<span class="timecurve-subnav__label">BUY</,
    );
    const arena = renderSubnav("arena", "/timecurve/arena");
    expect(arena).toMatch(
      /aria-current="page"[\s\S]*?<span class="timecurve-subnav__label">ARENA</,
    );
    const protocol = renderSubnav("protocol", "/timecurve/protocol");
    expect(protocol).toMatch(
      /aria-current="page"[\s\S]*?<span class="timecurve-subnav__label">AUDIT</,
    );
  });

  it("keeps the simple-tab href as the bare /timecurve so Home → /timecurve does not 404", () => {
    const html = renderSubnav("simple", "/timecurve");
    expect(html).toContain('href="/timecurve"');
    expect(html).toContain('href="/timecurve/arena"');
    expect(html).toContain('href="/timecurve/protocol"');
  });

  it("renders the issue #45 sub-nav pictogram for each tab (purpose-folder paths)", () => {
    const html = renderSubnav("simple", "/timecurve");
    expect(html).toContain('src="/art/icons/nav-simple.png"');
    expect(html).toContain('src="/art/icons/nav-arena.png"');
    expect(html).toContain('src="/art/icons/nav-protocol.png"');
  });

  it("renders ABOUT TIMECURVE disclosure open by default with tab icons in the blurb", () => {
    const html = renderSubnav("simple", "/timecurve");
    expect(html).toContain('class="timecurve-subnav-about" open');
    expect(html).toContain("ABOUT TIMECURVE");
    expect(html).toContain("BattlePoints");
    expect(html).toContain("audit the buy log");
    /* Same pictograms appear in nav links and in the about lines (6 img total). */
    const n = html.split('src="/art/icons/nav-simple.png"').length - 1;
    expect(n).toBe(2);
  });
});

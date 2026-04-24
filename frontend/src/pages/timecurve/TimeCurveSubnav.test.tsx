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
    const simpleIdx = html.indexOf("Simple");
    const arenaIdx = html.indexOf("Arena");
    const protocolIdx = html.indexOf("Protocol");
    expect(simpleIdx).toBeGreaterThan(-1);
    expect(arenaIdx).toBeGreaterThan(simpleIdx);
    expect(protocolIdx).toBeGreaterThan(arenaIdx);
  });

  it("marks the active tab via aria-current on the matching link", () => {
    const simple = renderSubnav("simple", "/timecurve");
    expect(simple).toMatch(
      /aria-current="page"[\s\S]*?<span class="timecurve-subnav__label">Simple</,
    );
    const arena = renderSubnav("arena", "/timecurve/arena");
    expect(arena).toMatch(
      /aria-current="page"[\s\S]*?<span class="timecurve-subnav__label">Arena</,
    );
    const protocol = renderSubnav("protocol", "/timecurve/protocol");
    expect(protocol).toMatch(
      /aria-current="page"[\s\S]*?<span class="timecurve-subnav__label">Protocol</,
    );
  });

  it("keeps `Simple` href as the bare /timecurve so Home → /timecurve does not 404", () => {
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
});

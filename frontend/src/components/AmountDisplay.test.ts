// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AmountDisplay } from "./AmountDisplay";
import { UnixTimestampDisplay } from "./UnixTimestampDisplay";

/** GitLab #9: block-level nodes under `<p>` are invalid HTML and break SSR/hydration. */
function assertPhrasingSafeUnderP(markup: string) {
  expect(markup).toMatch(/^<p[\s>]/);
  expect(markup).not.toMatch(/<p[^>]*>[\s\S]*<div\b/i);
}

describe("AmountDisplay (DOM nesting / SSR)", () => {
  it("renders only phrasing content — safe inside <p> (issue #9)", () => {
    const html = renderToStaticMarkup(
      createElement("p", null, createElement(AmountDisplay, { raw: "1953145177291660455", decimals: 18 })),
    );
    assertPhrasingSafeUnderP(html);
    expect(html).toContain("amount-triple");
    expect(html).toContain("1.953");
    expect(html).not.toContain("1953145177291660455");
  });

  it("compact-formats very large balances with scientific notation (4 sigfigs)", () => {
    const html = renderToStaticMarkup(
      createElement(AmountDisplay, {
        raw: "1001000099999960965960014708803254",
        decimals: 18,
      }),
    );
    expect(html).toContain("1.001e+15");
    expect(html).not.toContain("1001000099999960");
  });

  it("optional leadingLabel stays phrasing-safe and can disable monospace value", () => {
    const html = renderToStaticMarkup(
      createElement(
        "p",
        null,
        createElement(AmountDisplay, {
          raw: "1001000099999960965960014708803254",
          decimals: 18,
          leadingLabel: "YOUR CL8Y:",
          valueMono: false,
        }),
      ),
    );
    assertPhrasingSafeUnderP(html);
    expect(html).toContain("YOUR CL8Y:");
    expect(html).toContain("1.001e+15");
    expect(html).not.toMatch(/class="[^"]*\bmono\b/);
  });
});

describe("UnixTimestampDisplay (DOM nesting / SSR)", () => {
  it("matches AmountDisplay phrasing model for shared layout", () => {
    const html = renderToStaticMarkup(
      createElement("p", null, createElement(UnixTimestampDisplay, { raw: "1700000000" })),
    );
    assertPhrasingSafeUnderP(html);
    expect(html).toContain("amount-triple");
    expect(html).toContain("utc");
    expect(html).toMatch(/2023-11-14T22:13:20\.000Z/);
    expect(html).not.toContain("1700000000");
  });
});

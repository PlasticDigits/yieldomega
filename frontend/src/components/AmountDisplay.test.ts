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
      createElement("p", null, createElement(AmountDisplay, { raw: 1953145177291660455n, decimals: 18 })),
    );
    assertPhrasingSafeUnderP(html);
    expect(html).toContain("amount-triple");
    expect(html).toContain("1.953145177291660455");
    expect(html).toContain("1.95");
    expect(html).not.toContain("1953145177291660455");
  });
});

describe("UnixTimestampDisplay (DOM nesting / SSR)", () => {
  it("matches AmountDisplay phrasing model for shared layout", () => {
    const html = renderToStaticMarkup(
      createElement("p", null, createElement(UnixTimestampDisplay, { raw: 1700000000n })),
    );
    assertPhrasingSafeUnderP(html);
    expect(html).toContain("amount-triple");
    expect(html).toContain("utc");
    expect(html).toMatch(/2023-11-14T22:13:20\.000Z/);
    expect(html).not.toContain("1700000000");
  });
});

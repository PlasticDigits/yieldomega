// SPDX-License-Identifier: AGPL-3.0-only

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LaunchCountdownPage } from "./LaunchCountdownPage";

describe("LaunchCountdownPage", () => {
  it("frames the gate as Time Arena access, not a DOUB sale launch (GitLab #295)", () => {
    const html = renderToStaticMarkup(<LaunchCountdownPage secondsRemaining={90_061} />);

    expect(html).toContain("Time Arena opens in");
    expect(html).toContain("PvP console gate. Prepare to play.");
    expect(html).toContain("PLAY");
    expect(html).toContain("CRED");
    expect(html).toContain("PVP");
    expect(html).toContain("AUDIT");
    expect(html).not.toMatch(/DOUB launches|goes live|TimeCurve|\bsale\b|launchpad|worldbuilding|\bPvE\b/i);
  });
});

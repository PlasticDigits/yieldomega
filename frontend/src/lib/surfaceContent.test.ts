// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { HOME_SURFACE_CARDS } from "./surfaceContent";

describe("HOME_SURFACE_CARDS", () => {
  it("points the primary home card at /arena (GitLab #243)", () => {
    const arena = HOME_SURFACE_CARDS.find((c) => c.title === "Time Arena");
    expect(arena?.to).toBe("/arena");
  });

  it("uses current Time Arena command-console copy for the primary card (GitLab #290)", () => {
    const arena = HOME_SURFACE_CARDS.find((c) => c.title === "Time Arena");
    expect(arena?.blurb).toBe("Buy CHARM, pressure the timers, and compete for DOUB podiums");
    expect(arena?.imageAlt).toContain("command-console");
    expect(arena?.imageAlt).not.toMatch(/fair-launch|arcade/i);
  });
});

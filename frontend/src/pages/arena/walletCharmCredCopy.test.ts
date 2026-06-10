// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { walletCharmCredHelpCopy } from "./walletCharmCredCopy";

describe("walletCharmCredHelpCopy", () => {
  it("documents Levels, XP, CHARM, and CRED for the wallet help modal", () => {
    const copy = walletCharmCredHelpCopy();
    expect(copy.title).toBe("Your wallet");
    expect(copy.sections.map((section) => section.heading)).toEqual([
      "Levels",
      "XP",
      "CHARM",
      "CRED",
    ]);
    expect(copy.sections[0]?.body).toContain("Level 1");
    expect(copy.sections[1]?.body).toContain("1.00");
    expect(copy.sections[1]?.body).toContain("10 XP");
    expect(copy.sections[2]?.body).toContain("Last Buy epoch");
    expect(copy.sections[3]?.body).toContain("35 CRED");
  });
});

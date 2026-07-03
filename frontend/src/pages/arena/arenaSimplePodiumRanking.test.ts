// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { rankingRowsForPodium } from "./arenaSimplePodiumRanking";

const ALICE = "0x1111111111111111111111111111111111111111" as const;

describe("rankingRowsForPodium prize preview index", () => {
  it("maps UX WarBow slot to onchain category 3 prize pools", () => {
    const rows = rankingRowsForPodium(
      { winners: [ALICE, ALICE, ALICE], values: ["250", "0", "0"] },
      1,
      undefined,
      [
        { places: ["1000000000000000000", "0", "0"] },
        { places: ["2000000000000000000", "0", "0"] },
        { places: ["3000000000000000000", "0", "0"] },
        { places: ["4000000000000000000", "0", "0"] },
      ],
      18,
      1_700_000_000,
      null,
      undefined,
      { includeUsdPrize: false },
    );
    const prizeHtml = renderToStaticMarkup(rows[0]!.value as ReactElement);
    expect(prizeHtml).toContain("4");
    expect(prizeHtml).not.toContain("2");
  });

  it("maps UX Time Booster slot to onchain category 1 prize pools", () => {
    const rows = rankingRowsForPodium(
      { winners: [ALICE, ALICE, ALICE], values: ["300", "240", "60"] },
      3,
      undefined,
      [
        { places: ["1000000000000000000", "0", "0"] },
        { places: ["2000000000000000000", "0", "0"] },
        { places: ["3000000000000000000", "0", "0"] },
        { places: ["4000000000000000000", "0", "0"] },
      ],
      18,
      1_700_000_000,
      null,
      undefined,
      { includeUsdPrize: false },
    );
    const prizeHtml = renderToStaticMarkup(rows[0]!.value as ReactElement);
    expect(prizeHtml).toContain("2");
    expect(prizeHtml).not.toContain("4");
  });
});

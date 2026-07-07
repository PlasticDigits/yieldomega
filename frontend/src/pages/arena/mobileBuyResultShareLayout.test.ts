// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM } from "@/audio/mobileAlbumDockLayout";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_BUY_RESULT_SHARE_GAP_ABOVE_HEADER_REM = 0.35;

describe("mobileBuyResultShareLayout (#365)", () => {
  it("offsets the buy result share card above the fixed mobile bottom nav", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../../styles/yieldomega-glass-arena.css"),
      "utf8",
    );
    const mobileBlock = css.match(
      /@media \(max-width: 720px\) \{[\s\S]*?\.arena-buy-result-share \{[\s\S]*?padding-bottom: calc\([\s\S]*?\);[\s\S]*?\}/,
    );
    expect(mobileBlock).not.toBeNull();
    expect(mobileBlock![0]).toContain(
      `max(0.4rem, env(safe-area-inset-bottom, 0px)) + ${MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM}rem + ${MOBILE_BUY_RESULT_SHARE_GAP_ABOVE_HEADER_REM}rem`,
    );
  });

  it("keeps share card font sizes at or above arena toast minimums", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../../styles/yieldomega-glass-arena.css"),
      "utf8",
    );
    expect(css).toMatch(/\.arena-buy-result-share__row \{[\s\S]*?font-size: 0\.72rem/);
    expect(css).toMatch(
      /@media \(max-width: 720px\) \{[\s\S]*?\.arena-buy-result-share__row \{[\s\S]*?font-size: 0\.68rem/,
    );
  });
});

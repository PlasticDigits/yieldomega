// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM } from "@/audio/mobileAlbumDockLayout";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MOBILE_BUY_EFFECT_TOAST_GAP_ABOVE_HEADER_REM = 0.35;

describe("mobileBuyEffectToastLayout (#337)", () => {
  it("offsets the toast stack above the fixed mobile bottom nav with a small gap", () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, "../../styles/yieldomega-glass-arena.css"),
      "utf8",
    );
    const mobileToastBlock = css.match(
      /\.arena-effect-toast-stack \{[\s\S]*?@media \(max-width: 720px\) \{[\s\S]*?\.arena-effect-toast-stack \{[\s\S]*?\}[\s\S]*?\}/,
    );
    expect(mobileToastBlock).not.toBeNull();
    expect(mobileToastBlock![0]).toContain(
      `bottom: calc(max(0.4rem, env(safe-area-inset-bottom, 0px)) + ${MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM}rem + ${MOBILE_BUY_EFFECT_TOAST_GAP_ABOVE_HEADER_REM}rem);`,
    );
  });
});

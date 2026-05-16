// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM } from "./mobileAlbumDockLayout";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("mobileAlbumDockLayout (GitLab #103, parity test #107)", () => {
  it("exports canonical clearance rem for INV-AUDIO-103", () => {
    expect(MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM).toBe(3.95);
  });

  it("TS constant matches index.css safe-area-inset-bottom + Nrem (INV-AUDIO-103)", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
    const m = css.match(/bottom:\s*calc\(max\(0\.4rem,\s*env\(safe-area-inset-bottom,\s*0px\)\)\s*\+\s*([\d.]+)rem\)/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBe(MOBILE_ALBUM_DOCK_CLEARANCE_ABOVE_HEADER_REM);
  });
});

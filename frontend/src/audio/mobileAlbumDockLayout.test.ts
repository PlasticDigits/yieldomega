// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM } from "./mobileAlbumDockLayout";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("mobileAlbumDockLayout (GitLab #103, parity test #107)", () => {
  it("exports canonical clearance rem for INV-AUDIO-103", () => {
    expect(MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM).toBe(4.5);
  });

  it("TS constant matches index.css safe-area-inset-top + Nrem (INV-AUDIO-103)", () => {
    const css = fs.readFileSync(path.resolve(__dirname, "../index.css"), "utf8");
    const m = css.match(/env\(safe-area-inset-top,\s*0px\)\s*\+\s*([\d.]+)rem/);
    expect(m).not.toBeNull();
    expect(parseFloat(m![1])).toBe(MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM);
  });
});

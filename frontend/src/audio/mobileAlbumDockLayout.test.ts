// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM } from "./mobileAlbumDockLayout";

describe("mobileAlbumDockLayout (GitLab #103)", () => {
  it("exports clearance rem token mirrored in index.css for INV-AUDIO-103", () => {
    expect(MOBILE_HEADER_TOP_CLEARANCE_BELOW_SAFE_AREA_REM).toBe(4.5);
  });
});

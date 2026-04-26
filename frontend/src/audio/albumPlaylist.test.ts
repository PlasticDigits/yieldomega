// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { ALBUM_1_PLAYLIST } from "./albumPlaylist";

describe("ALBUM_1_PLAYLIST", () => {
  it("matches GitLab #68 acceptance (first eight album_1 tracks)", () => {
    expect(ALBUM_1_PLAYLIST).toHaveLength(8);
    expect(ALBUM_1_PLAYLIST[0].src).toContain("01-hills-dawn");
    expect(ALBUM_1_PLAYLIST[7].src).toContain("08-kumbaya-campfire");
  });
});

// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { homeHubPath } from "./launchHubRoute";

describe("homeHubPath", () => {
  it("returns /home for the brand hub while / is play-first arena", () => {
    expect(homeHubPath()).toBe("/home");
  });
});

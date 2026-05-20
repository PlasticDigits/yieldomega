// SPDX-License-Identifier: AGPL-3.0-only

import { afterEach, describe, expect, it, vi } from "vitest";
import { homeHubPath } from "./launchHubRoute";

describe("homeHubPath", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns / when VITE_LAUNCH_TIMESTAMP is unset", () => {
    vi.stubEnv("VITE_LAUNCH_TIMESTAMP", "");
    expect(homeHubPath()).toBe("/");
  });

  it("returns /home when VITE_LAUNCH_TIMESTAMP is set", () => {
    vi.stubEnv("VITE_LAUNCH_TIMESTAMP", "1700000000");
    expect(homeHubPath()).toBe("/home");
  });
});

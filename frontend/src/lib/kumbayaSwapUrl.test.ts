// SPDX-License-Identifier: AGPL-3.0-only
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("buyTokenOnKumbayaUrl — GitLab #206 referrals -> Kumbaya swap link", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("returns swap URL with output currency when token address is provided", async () => {
    vi.stubEnv("VITE_KUMBAYA_DEX_URL", "");
    const { buyTokenOnKumbayaUrl } = await import("./kumbayaSwapUrl");
    const url = buyTokenOnKumbayaUrl("0xfBAa45A537cF07dC768c469FfaC4e88208B0098D");
    expect(url).toContain("kumbaya.xyz");
    expect(url).toContain("outputCurrency=0xfBAa45A537cF07dC768c469FfaC4e88208B0098D");
    expect(url).toContain("confirmed=1");
  });

  it("returns base swap URL when output token is undefined or empty", async () => {
    vi.stubEnv("VITE_KUMBAYA_DEX_URL", "");
    const { buyTokenOnKumbayaUrl } = await import("./kumbayaSwapUrl");
    expect(buyTokenOnKumbayaUrl(undefined)).toBe("https://www.kumbaya.xyz/#/swap");
    expect(buyTokenOnKumbayaUrl("")).toBe("https://www.kumbaya.xyz/#/swap");
  });

  it("uses VITE_KUMBAYA_DEX_URL when set", async () => {
    vi.stubEnv("VITE_KUMBAYA_DEX_URL", "https://example.kumbaya.test/#/swap");
    const { buyTokenOnKumbayaUrl } = await import("./kumbayaSwapUrl");
    const url = buyTokenOnKumbayaUrl("0xfBAa45A537cF07dC768c469FfaC4e88208B0098D");
    expect(url).toContain("example.kumbaya.test");
    expect(url).toContain("outputCurrency=0xfBAa45A537cF07dC768c469FfaC4e88208B0098D");
  });

  it("always returns an absolute https URL", async () => {
    const { buyTokenOnKumbayaUrl } = await import("./kumbayaSwapUrl");
    expect(buyTokenOnKumbayaUrl("0xfBAa45A537cF07dC768c469FfaC4e88208B0098D").startsWith("https://")).toBe(true);
    expect(buyTokenOnKumbayaUrl(undefined).startsWith("https://")).toBe(true);
  });
});

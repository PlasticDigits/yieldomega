// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("AppProviders wallet theme (GitLab #290)", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "AppProviders.tsx"), "utf8");

  it("uses the dark cyber console RainbowKit theme", () => {
    expect(source).toContain("darkTheme");
    expect(source).toContain("const cyberWalletTheme");
    expect(source).toContain('accentColor: "#35f0c2"');
    expect(source).toContain('accentColorForeground: "#061318"');
    expect(source).not.toContain("lightTheme");
    expect(source).not.toContain("arcadeWalletTheme");
  });
});

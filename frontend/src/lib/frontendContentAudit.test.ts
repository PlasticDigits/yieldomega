import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// SPDX-License-Identifier: AGPL-3.0-only

const REPO_ROOT = path.resolve(__dirname, "../../..");
const AUDIT_DOC = path.join(REPO_ROOT, "docs/testing/frontend-content-audit.md");

const REQUIRED_ROUTE_SECTIONS = [
  "## `/` and `/home`",
  "## `/` — Time Arena play surface",
  "## `/audit`",
  "## `/:code`",
  "## `/referrals`",
  "## `/kumbaya` and `/sir`",
  "## 404 and under-construction fallbacks",
  "## Legacy route redirects",
] as const;

describe("frontend content audit doc (GitLab #298)", () => {
  const audit = fs.readFileSync(AUDIT_DOC, "utf8");

  it("documents every routed surface with canonical TimeArena cross-links", () => {
    for (const section of REQUIRED_ROUTE_SECTIONS) {
      expect(audit).toContain(section);
    }
    expect(audit).toContain("time-arena.md");
    expect(audit).toContain("INV-FRONTEND-298-UX-DOCS-E2E");
  });

  it("requires Yield Omega branding and forbids legacy launchpad framing", () => {
    expect(audit).toContain("**Yield Omega**");
    expect(audit).toMatch(/Forbidden framing.*TimeCurve/s);
    expect(audit).toContain("bash scripts/check-arena-naming.sh");
  });

  it("maps Playwright E2E specs for non-Anvil smoke", () => {
    expect(audit).toContain("e2e/arena.spec.ts");
    expect(audit).toContain("e2e/home.spec.ts");
    expect(audit).toContain("e2e/surface-shells.spec.ts");
    expect(audit).toContain("--workers=5");
  });
});

describe("Playwright arena branding (GitLab #298)", () => {
  const arenaE2e = fs.readFileSync(path.resolve(__dirname, "../../e2e/arena.spec.ts"), "utf8");
  const surfaceE2e = fs.readFileSync(
    path.resolve(__dirname, "../../e2e/surface-shells.spec.ts"),
    "utf8",
  );

  it("asserts Yield Omega on the command console", () => {
    expect(arenaE2e).toContain('getByText("Yield Omega", { exact: true })');
  });

  it("uses redesigned third-party venue copy on Kumbaya", () => {
    expect(surfaceE2e).toContain("Third-party venue. Verify off-site.");
    expect(surfaceE2e).toContain(/canonical DOUB arena surface/i);
  });
});

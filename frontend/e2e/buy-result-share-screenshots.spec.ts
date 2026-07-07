// SPDX-License-Identifier: AGPL-3.0-only

import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mockArenaReadsMinimal } from "./arenaE2eHelpers";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../../docs/testing/screenshots/issue-365");

const FIXTURE_SUMMARY = {
  headline: "⏱ +2m · 🏆 Last Buyer · +750 BP",
  rows: [
    { icon: "⏱", label: "Timer", value: "+2m", tone: "timer" },
    { icon: "⚡", label: "XP", value: "+12", tone: "xp" },
    { icon: "🏆", label: "Rank", value: "Last Buyer", tone: "rank" },
    { icon: "⚔", label: "Battle points", value: "+750 BP (Base + Reset)", tone: "warbow" },
  ],
  txHash: "0xabc1234567890123456789012345678901234567890123456789012345678901234",
  shareText: "Yield Omega — Time Arena buy\n⏱ +2m · 🏆 Last Buyer · +750 BP",
  pending: false,
};

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

test.describe("Buy result share popover screenshots (#365)", () => {
  test.beforeAll(() => {
    mkdirSync(outDir, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as Window & { __yieldomegaE2eBuyResultEnabled?: boolean }).__yieldomegaE2eBuyResultEnabled =
        true;
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} — full card fits viewport`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockArenaReadsMinimal(page);
      await page.goto("/");
      await expect(page.getByTestId("arena-command-console")).toBeVisible({ timeout: 30_000 });
      await page.evaluate((summary) => {
        const w = window as Window & {
          __yieldomegaE2eShowBuyResult?: (s: typeof summary) => void;
        };
        w.__yieldomegaE2eShowBuyResult?.(summary);
      }, FIXTURE_SUMMARY);
      const panel = page.getByTestId("arena-buy-result-share-panel");
      await expect(panel).toBeVisible({ timeout: 10_000 });
      const box = await panel.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      await page.screenshot({
        path: resolve(outDir, `${viewport.name}.png`),
        fullPage: false,
      });
    });
  }
});

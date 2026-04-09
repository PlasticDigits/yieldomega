// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

test("timecurve page loads", async ({ page }) => {
  await page.goto("/timecurve");
  await expect(page.locator("main.app-main")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Buy charms", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Prize chase and standings", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What matters now", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live battle feed", level: 2 })).toBeVisible();
});

test("timecurve mobile layout keeps top gameplay surfaces visible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/timecurve");
  await expect(page.getByRole("heading", { name: "Buy charms", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What matters now", level: 2 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "WarBow moves and rivalry", level: 2 })).toBeVisible();
});

// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

test("home shows title and nav links", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "YieldOmega", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Primary").getByRole("link", { name: "TimeCurve" }),
  ).toBeVisible();
});

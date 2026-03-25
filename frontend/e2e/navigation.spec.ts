// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

test("deep link from home to each surface", async ({ page }) => {
  const nav = page.getByLabel("Primary");

  await page.goto("/");
  await nav.getByRole("link", { name: "TimeCurve" }).click();
  await expect(page).toHaveURL(/\/timecurve$/);

  await page.goto("/");
  await nav.getByRole("link", { name: "Rabbit Treasury" }).click();
  await expect(page).toHaveURL(/\/rabbit-treasury$/);

  await page.goto("/");
  await nav.getByRole("link", { name: "Collection" }).click();
  await expect(page).toHaveURL(/\/collection$/);
});

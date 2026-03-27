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

  await page.goto("/");
  await nav.getByRole("link", { name: "Referrals" }).click();
  await expect(page).toHaveURL(/\/referrals$/);

  await page.goto("/");
  await nav.getByRole("link", { name: "Kumbaya" }).click();
  await expect(page).toHaveURL(/\/kumbaya$/);

  await page.goto("/");
  await nav.getByRole("link", { name: "Sir" }).click();
  await expect(page).toHaveURL(/\/sir$/);
});

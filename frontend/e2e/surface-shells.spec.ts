// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";

test("placeholder and third-party routes use the shared branded shell", async ({ page }) => {
  await page.goto("/rabbit-treasury");
  await expect(page.getByRole("heading", { name: "Rabbit Treasury", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open TimeCurve" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Launch Track", level: 2 })).toBeVisible();

  await page.goto("/kumbaya");
  await expect(page.getByRole("heading", { name: "Kumbaya", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Venue Snapshot", level: 2 })).toBeVisible();
  await expect(page.getByText(/Kumbaya is a third-party/i)).toBeVisible();
  await expect(page.getByText(/Set VITE_KUMBAYA_DEX_URL at build time to add the outbound venue link./i)).toHaveCount(1);
  await expect(page.getByText(/canonical DOUB launch surface/i)).toBeVisible();
});

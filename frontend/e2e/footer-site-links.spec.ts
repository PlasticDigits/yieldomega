// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("footer site links card on footer-enabled routes (GitLab #232)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Launch countdown hides global footer.");

  await page.goto("/referrals");
  const card = page.getByTestId("footer-site-links-card");
  await expect(card).toBeVisible();
  const ribbon = card.getByTestId("footer-site-links");
  await expect(ribbon).toBeVisible();
  await expect(ribbon.getByRole("link", { name: "X" })).toHaveAttribute("href", "https://x.com/yieldomega");
  await expect(ribbon.getByRole("link", { name: "contact@yieldomega.com" })).toHaveAttribute(
    "href",
    "mailto:contact@yieldomega.com",
  );
  await expect(ribbon.getByRole("link", { name: "Agent SKILL.md" })).toHaveAttribute(
    "href",
    /github\.com\/PlasticDigits\/yieldomega\/blob\/main\/skills\/play-active-timecurve\/SKILL\.md/,
  );
  await expect(ribbon.locator(".footer-link-pill__icon").first()).toBeVisible();
});

test("/timecurve Simple shows site links card below agent card (GitLab #232)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Launch countdown hides TimeCurve surfaces.");

  await page.goto("/timecurve");
  const card = page.getByTestId("footer-site-links-card");
  await expect(card).toBeVisible();
  const ribbon = card.getByTestId("footer-site-links");
  await expect(ribbon.getByRole("link", { name: "CL8Y Bridge" })).toHaveAttribute(
    "href",
    "https://bridge.cl8y.com",
  );
  await expect(page.getByTestId("timecurve-simple-agent-card").getByTestId("footer-site-links")).toHaveCount(
    0,
  );
});

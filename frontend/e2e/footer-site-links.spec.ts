// SPDX-License-Identifier: AGPL-3.0-only
import { expect, test } from "@playwright/test";
import { detectLaunchState } from "./launchState";

test("footer site link ribbon on footer-enabled routes (GitLab #232)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Launch countdown hides global footer.");

  await page.goto("/referrals");
  const agentCard = page.locator(".app-footer-agent");
  await agentCard.locator("summary").click();
  const ribbon = page.getByTestId("footer-site-links");
  await expect(ribbon).toBeVisible();
  await expect(ribbon.getByRole("link", { name: "X" })).toHaveAttribute("href", "https://x.com/yieldomega");
  await expect(ribbon.getByRole("link", { name: "Play active TimeCurve" })).toHaveAttribute(
    "href",
    /github\.com\/PlasticDigits\/yieldomega\/blob\/main\/skills\/play-active-timecurve\/SKILL\.md/,
  );
});

test("/timecurve Simple agent card mirrors site link ribbon (GitLab #232)", async ({ page }) => {
  const state = await detectLaunchState(page);
  test.skip(state === "countdown", "Launch countdown hides TimeCurve surfaces.");

  await page.goto("/timecurve");
  const agentCard = page.getByTestId("timecurve-simple-agent-card");
  await expect(agentCard).toBeVisible();
  await agentCard.locator("summary").click();
  const ribbon = agentCard.getByTestId("footer-site-links");
  await expect(ribbon).toBeVisible();
  await expect(ribbon.getByRole("link", { name: "CL8Y Bridge" })).toHaveAttribute(
    "href",
    "https://bridge.cl8y.com",
  );
});

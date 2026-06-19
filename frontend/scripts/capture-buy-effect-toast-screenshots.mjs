#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
/** Capture post-buy effect toast screenshots for GitLab #337 (desktop / tablet / mobile). */
import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = process.env.BUY_TOAST_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:5173";
const OUT_DIR = resolve(
  process.env.BUY_TOAST_SCREENSHOT_DIR ?? "/tmp/yieldomega-buy-toast-screenshots-337",
);
const TIMEOUT_MS = 90_000;

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

function buyPanel(page) {
  return page.locator(".arena-simple__buy-panel");
}

async function connectMockWallet(page) {
  const panel = buyPanel(page);
  const connectButton = panel.getByRole("button", { name: /connect/i });
  if (await connectButton.isVisible().catch(() => false)) {
    await connectButton.first().click();
    await page.getByRole("button", { name: /Mock Connector/i }).click();
  }
  await panel.getByTestId("arena-simple-buy-charm").waitFor({ state: "visible", timeout: TIMEOUT_MS });
}

async function setCharmSliderMin(page) {
  const slider = page.locator('input[type="range"].arena-buy-spend-range');
  await slider.evaluate((el) => {
    el.value = el.min;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORTS[0] });
  const paths = [];
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.getByTestId("arena-command-console").waitFor({ state: "visible", timeout: TIMEOUT_MS });
    await page.getByText("Loading contract reads…").waitFor({ state: "hidden", timeout: TIMEOUT_MS }).catch(() => {});
    await connectMockWallet(page);
    await setCharmSliderMin(page);
    await page.getByTestId("arena-simple-buy-charm").click();
    const toast = page.getByTestId("arena-buy-effect-toast").first();
    await toast.waitFor({ state: "visible", timeout: TIMEOUT_MS });
    await page.waitForTimeout(400);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(250);
      const outPath = resolve(OUT_DIR, `issue-337-toast-${viewport.name}.png`);
      await page.screenshot({ path: outPath, fullPage: false });
      paths.push(outPath);
      console.log(`Wrote ${outPath}`);
    }
  } finally {
    await browser.close();
  }
  await writeFile(resolve(OUT_DIR, "manifest.txt"), paths.join("\n") + "\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

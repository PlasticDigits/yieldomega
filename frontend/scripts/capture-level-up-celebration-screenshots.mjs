#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
/** Capture level-up celebration screenshots for GitLab #335 (desktop / tablet / mobile). */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const BASE_URL = process.env.LEVEL_UP_SCREENSHOT_BASE_URL ?? "http://127.0.0.1:4173";
const OUT_DIR = resolve(
  process.env.LEVEL_UP_SCREENSHOT_DIR ?? "/tmp/yieldomega-level-up-screenshots-335",
);
const TIMEOUT_MS = 90_000;
const ANVIL_RPC = process.env.ANVIL_RPC ?? "http://127.0.0.1:8545";
const MOCK_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
const STARTER_CHARM_WAD = "10000000000000000000";

const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

function envLocalValue(key) {
  const text = readFileSync(resolve(".env.local"), "utf8");
  const line = text.split("\n").find((row) => row.startsWith(`${key}=`));
  return line?.slice(key.length + 1).trim() ?? "";
}

function castOut(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim().split(/\s+/)[0];
}

async function warpAnvilTime(seconds) {
  await fetch(ANVIL_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "anvil_increaseTime", params: [seconds] }),
  });
  await fetch(ANVIL_RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "anvil_mine", params: ["0x2"] }),
  });
}

function onChainStarterCredBuy() {
  const ta = envLocalValue("VITE_TIME_ARENA_ADDRESS");
  const cred = castOut(`cast call "${ta}" "playCred()(address)" --rpc-url "${ANVIL_RPC}"`);
  execSync(
    `cast send "${cred}" "mint(address,uint256)" "${MOCK_WALLET}" 10000000000000000000000 --from "${MOCK_WALLET}" --unlocked --rpc-url "${ANVIL_RPC}"`,
    { stdio: "ignore" },
  );
  execSync(
    `cast send "${ta}" "buyWithCred(uint256)" ${STARTER_CHARM_WAD} --from "${MOCK_WALLET}" --unlocked --rpc-url "${ANVIL_RPC}"`,
    { stdio: "ignore" },
  );
}

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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await warpAnvilTime(500);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORTS[0] });
  const paths = [];
  try {
    await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: TIMEOUT_MS });
    await page.getByTestId("arena-command-console").waitFor({ state: "visible", timeout: TIMEOUT_MS });
    await connectMockWallet(page);
    await page.getByTestId("arena-xp-hero-level").waitFor({ state: "visible", timeout: TIMEOUT_MS });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      localStorage.removeItem("yieldomega.arena.featureTutorialSeen.v1.time_booster");
    });
    onChainStarterCredBuy();
    const celebration = page.getByTestId("level-up-celebration");
    await celebration.waitFor({ state: "visible", timeout: TIMEOUT_MS });
    await page.waitForTimeout(600);
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(300);
      const outPath = resolve(OUT_DIR, `level-up-celebration-${viewport.name}.png`);
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

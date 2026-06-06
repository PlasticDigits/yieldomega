#!/usr/bin/env node
/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * One-time Rabby onboarding: password + import KEY_EVM_1..3 private keys.
 * Requires unpacked Rabby at RABBY_EXTENSION_PATH and Playwright Chromium.
 *
 * Usage (from repo root, after frontend npm ci):
 *   cd frontend && node ../scripts/setup-rabby-dev-wallets.mjs
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const { launchRabbyContext } = await import("./lib/rabby_playwright.mjs");

const RABBY_EXT =
  process.env.RABBY_EXTENSION_PATH ?? "/opt/cursor/browser-extensions/rabby";
const PROFILE =
  process.env.CHROME_RABBY_PROFILE ?? "/opt/cursor/chrome-profile-rabby";
const MARKER = join(PROFILE, ".yieldomega-rabby-dev-wallets-ready");
const PASSWORD =
  process.env.RABBY_DEV_PASSWORD ?? "YieldomegaDevOnly1!";

const DEFAULT_KEYS = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
];

const KEYS = [
  process.env.KEY_EVM_1 ?? DEFAULT_KEYS[0],
  process.env.KEY_EVM_2 ?? DEFAULT_KEYS[1],
  process.env.KEY_EVM_3 ?? DEFAULT_KEYS[2],
].map((k) => (k.startsWith("0x") ? k : `0x${k}`));

/** Chromium unpacked-extension id from absolute path (stable per VM path). */
function rabbyExtensionIdFromPath(extensionPath) {
  const hash = createHash("sha256").update(extensionPath).digest("hex");
  return [...hash.slice(0, 32)]
    .map((c) => String.fromCharCode("a".charCodeAt(0) + Number.parseInt(c, 16)))
    .join("");
}

function activePage(context) {
  const pages = context.pages().filter((p) => !p.isClosed());
  return pages.at(-1) ?? null;
}

async function importFirstPrivateKey(context, extId, privateKey) {
  let page = await context.newPage();
  await page.goto(`chrome-extension://${extId}/index.html`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.getByText("Next", { exact: true }).click();
  await page.getByText("Get Started", { exact: true }).click();
  await page.waitForTimeout(1500);
  page = activePage(context);
  if (!page) throw new Error("Rabby guide page missing after Get Started");

  await page.getByRole("button", { name: "I already have an address" }).click();
  await page.waitForTimeout(1000);
  await page.getByText("Seed Phrase or Private Key").click();
  await page.waitForTimeout(1000);
  await page.getByText("Private Key", { exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator("input").first().fill(privateKey);
  await page.getByRole("button", { name: "Next" }).click();
  await page.waitForTimeout(2500);

  const pwds = page.locator('input[type="password"]');
  const pwdCount = await pwds.count();
  if (pwdCount >= 1) {
    await pwds.nth(0).fill(PASSWORD);
    if (pwdCount >= 2) await pwds.nth(1).fill(PASSWORD);
    await page
      .getByRole("button", { name: /confirm|next|done/i })
      .click()
      .catch(() => {});
    await page.waitForTimeout(2000);
  }
}

async function unlockDashboard(page, extId) {
  await page.goto(`chrome-extension://${extId}/index.html#/dashboard`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const unlock = page.locator('input[type="password"]');
  if ((await unlock.count()) > 0) {
    await unlock.fill(PASSWORD);
    await page.getByRole("button", { name: "Unlock" }).click();
    await page.waitForTimeout(2000);
  }
}

async function importAdditionalPrivateKey(context, extId, privateKey) {
  const dash =
    context.pages().find((p) => p.url().includes("/dashboard") && !p.isClosed()) ??
    (await context.newPage());
  await unlockDashboard(dash, extId);

  await dash.getByText(/Private Key \d+/).first().click();
  await dash.getByText("Add New Address").click();
  await dash.waitForTimeout(800);
  await dash.getByText("Import Private Key", { exact: true }).click();
  await dash.waitForTimeout(1500);

  const importPage =
    context.pages().find((p) => p.url().includes("add-address/import") && !p.isClosed()) ??
    activePage(context);
  if (!importPage) throw new Error("Rabby add-address import page missing");

  await importPage.locator("textarea, input").first().fill(privateKey);
  await importPage.getByRole("button", { name: "Confirm" }).click();
  await importPage.waitForTimeout(2500);
  if (!importPage.isClosed()) await importPage.close();
}

async function main() {
  if (existsSync(MARKER)) {
    console.log("Rabby dev wallets already configured:", MARKER);
    return;
  }
  if (!existsSync(join(RABBY_EXT, "manifest.json"))) {
    console.error("Rabby not installed at", RABBY_EXT);
    process.exit(1);
  }

  mkdirSync(PROFILE, { recursive: true });
  const extId = rabbyExtensionIdFromPath(RABBY_EXT);

  const context = await launchRabbyContext({ headless: false });

  try {
    await importFirstPrivateKey(context, extId, KEYS[0]);
    for (let i = 1; i < KEYS.length; i += 1) {
      await importAdditionalPrivateKey(context, extId, KEYS[i]);
    }

    writeFileSync(MARKER, `keys=${KEYS.length}\n`, { mode: 0o600 });
    console.log("Rabby dev wallets imported; marker:", MARKER);
  } finally {
    await context.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

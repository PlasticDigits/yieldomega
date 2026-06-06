#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-only
/**
 * Smoke: Rabby injects window.ethereum in headed Playwright Chromium (xvfb on Cloud VMs).
 *
 * Usage (repo root):
 *   cd frontend && node ../scripts/verify-rabby-playwright-injection.mjs
 *
 * Env:
 *   YIELDOMEGA_REQUIRE_PLAYWRIGHT_CHROMIUM=1  — fail if bundled Chromium cache is absent
 *   CHROME_RABBY_VERIFY_PROFILE               — ephemeral profile (default: temp dir)
 */

import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const verifyProfile = process.env.CHROME_RABBY_VERIFY_PROFILE;
const cleanupProfile = Boolean(verifyProfile?.includes("yieldomega-rabby-verify-"));
if (verifyProfile) {
  process.env.CHROME_RABBY_PROFILE = verifyProfile;
}
process.env.YIELDOMEGA_REQUIRE_PLAYWRIGHT_CHROMIUM ??= "1";

const {
  assertRabbyInstalled,
  launchRabbyContext,
  rabbyExtensionIdFromPath,
  RABBY_EXT,
  releaseRabbyProfileLock,
  waitForEthereumProvider,
  warmUpRabbyExtension,
} = await import("./lib/rabby_playwright.mjs");

const PASSWORD = process.env.RABBY_DEV_PASSWORD ?? "YieldomegaDevOnly1!";

function startProbeServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end("<!doctype html><title>rabby-probe</title><body>rabby injection probe</body>");
    });
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}/` });
    });
  });
}

async function main() {
  assertRabbyInstalled();
  releaseRabbyProfileLock();
  const { server, url } = await startProbeServer();
  const extId = rabbyExtensionIdFromPath(RABBY_EXT);
  const context = await launchRabbyContext({ headless: false });
  try {
    await warmUpRabbyExtension(context, extId, PASSWORD);
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await waitForEthereumProvider(page, 45_000);
    const chainId = await page.evaluate(async () => {
      try {
        return await window.ethereum.request({ method: "eth_chainId" });
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    });
    if (!chainId || typeof chainId === "object") {
      throw new Error(`eth_chainId failed: ${JSON.stringify(chainId)}`);
    }
    console.log(`verify-rabby-playwright-injection: window.ethereum OK (chainId=${chainId})`);
  } finally {
    await context.close().catch(() => {});
    await new Promise((r) => server.close(r));
    if (cleanupProfile && verifyProfile) {
      rmSync(verifyProfile, { recursive: true, force: true });
    }
  }
}

main().catch((err) => {
  console.error("verify-rabby-playwright-injection FAILED:", err?.message ?? String(err));
  process.exit(1);
});

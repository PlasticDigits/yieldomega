// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "useArenaSaleSession.ts"), "utf8");

describe("useArenaSaleSession submit paths (GitLab #321)", () => {
  it("guards submitBuy when wallet write path is unavailable", () => {
    expect(src).toContain('setBuyError(WALLET_WRITE_NOT_READY_MESSAGE)');
    expect(src).toContain("resolveLiveWriteConnector(wagmiConfig)");
  });

  it("blocks submitBuy on chain mismatch, pause, and cooldown", () => {
    expect(src).toContain("chainMismatchWriteMessage(chainId)");
    expect(src).toContain("Time Arena is paused — buys and WarBow DOUB spend are disabled");
    expect(src).toContain('setBuyError("TimeArena: buy cooldown")');
  });

  it("routes CRED buys through buyWithCred with balance re-check", () => {
    expect(src).toContain('functionName: "buyWithCred"');
    expect(src).toContain("Not enough Play CRED in your wallet for this CHARM amount.");
    expect(src).toContain("credCheckoutBoundsGate.kind === \"insufficient_cred\"");
  });

  it("includes payUsesKumbaya in spend blur reconciliation deps", () => {
    const blurBlock = src.slice(src.indexOf("const setSpendFromInputBlur"), src.indexOf("const chainNowForCooldown"));
    expect(blurBlock).toContain("payUsesKumbaya");
    expect(blurBlock).toMatch(/payUsesKumbaya,\s*\n\s*quotedPayInWei/);
  });
});

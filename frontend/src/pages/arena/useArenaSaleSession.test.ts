// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(resolve(__dirname, "useArenaSaleSession.ts"), "utf8");

describe("useArenaSaleSession submit paths (GitLab #321)", () => {
  it("delegates sync submit guards to arenaSaleSessionBuyPreflight", () => {
    expect(src).toContain('import { arenaSaleSessionBuyPreflight }');
    expect(src).toContain("const preflightErr = arenaSaleSessionBuyPreflight(");
    expect(src).toContain("if (preflightErr) {");
    expect(src).toContain("setBuyError(preflightErr)");
  });

  it("routes CRED buys through buyWithCred with balance re-check", () => {
    expect(src).toContain('functionName: "buyWithCred"');
    expect(src).toContain("Not enough Play CRED in your wallet for this CHARM amount.");
  });

  it("includes payUsesKumbaya in spend blur reconciliation deps", () => {
    const blurBlock = src.slice(src.indexOf("const setSpendFromInputBlur"), src.indexOf("const chainNowForCooldown"));
    expect(blurBlock).toContain("payUsesKumbaya");
    expect(blurBlock).toContain("quotedPayInWei");
  });

  it("snaps buy spend to minimum when checkout is blocked", () => {
    expect(src).toContain("isArenaBuySpendDefaultMin");
    expect(src).toContain("buySpendDefaultMin");
    expect(src).toContain("quotedBandMinPayInWei");
    expect(src).toContain("formatArenaPaySpendInputDisplay");
    expect(src).toContain("paySpendInputCompactRef");
    expect(src).toContain("resolveArenaPayTokenSpendBand");
    expect(src).toContain("payTokenSpendBand");
    expect(src).toContain("payTokenWeiForDoubSpend");
    expect(src).not.toContain("currentPayTokenWei !== undefined");
  });

  it("refetches WarBow flag supplement after buy/claim success (#370)", () => {
    expect(src).toContain("refetch: refetchWarbowFlagSupplement");
    expect(src).toContain("void refetchWarbowFlagSupplement()");
    const refetchAllBlock = src.slice(
      src.indexOf("const refetchAll = useCallback"),
      src.indexOf("const arenaPaused ="),
    );
    expect(refetchAllBlock).toContain("refetchWarbowFlagSupplement");
  });
});

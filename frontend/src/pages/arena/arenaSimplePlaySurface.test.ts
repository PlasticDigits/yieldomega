// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { friendlyRevertMessage } from "@/lib/revertMessage";
import { phaseNarrative } from "@/pages/arena/arenaSimplePhase";

const arenaDir = path.resolve(__dirname);

function readArena(name: string): string {
  return fs.readFileSync(path.join(arenaDir, name), "utf8");
}

/** Strip block/line comments so JSDoc and dev notes do not trip copy guards. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("Arena play surface copy (#318 · INV-FRONTEND-298-UX-DOCS-E2E)", () => {
  const arenaSimplePage = stripComments(readArena("ArenaSimplePage.tsx"));
  const warbowPanel = readArena("ArenaWarbowHeroPanel.tsx");
  const saleSession = stripComments(readArena("useArenaSaleSession.ts"));

  it("keeps forbidden sale framing out of ArenaSimplePage user-visible strings", () => {
    expect(arenaSimplePage).not.toMatch(/The sale has not opened yet/i);
    expect(arenaSimplePage).not.toMatch(/>\s*[^<{]*\bsale\b[^<{]*</i);
    expect(arenaSimplePage).toContain("phaseNarrative(session.phase)");
    expect(arenaSimplePage).toContain("Buy CHARM unlocks automatically");
  });

  it("uses arenaSimplePhase pre-launch narrative without sale wording", () => {
    expect(phaseNarrative("saleStartPending")).not.toMatch(/\bsale\b/i);
    expect(phaseNarrative("saleActive")).not.toMatch(/\bsale\b/i);
  });

  it("avoids sale wording in play-surface buy guard errors", () => {
    expect(saleSession).not.toMatch(/setBuyError\([^)]*\bsale\b/i);
    expect(saleSession).toContain("wait for arena state");
  });

  it("maps TimeArena revert copy without sale framing on the play console", () => {
    for (const raw of [
      "TimeArena: not started",
      "TimeArena: timer expired",
      "TimeArenaBuyRouter__BadPhase()",
      "0x2be94f46",
    ]) {
      expect(friendlyRevertMessage(raw)).not.toMatch(/\bsale\b/i);
    }
    expect(friendlyRevertMessage("TimeArena: not started")).toBe("The arena has not opened yet.");
  });

  it("wires WarBow rival rows to wallet profile modal (#258, #318)", () => {
    expect(arenaSimplePage).toContain("onOpenWalletProfile={onOpenWalletProfile}");
    expect(arenaSimplePage).toMatch(/<ArenaWarbowHeroPanel[\s\S]*onOpenWalletProfile=\{onOpenWalletProfile\}/);
    expect(warbowPanel).toContain("onOpenWalletProfile?: (address: string) => void");
    expect(warbowPanel).toContain("onOpenProfile={onOpenWalletProfile}");
    expect(warbowPanel).toContain("targetIsInsideAddressAction");
  });
});

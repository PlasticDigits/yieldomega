// SPDX-License-Identifier: AGPL-3.0-only

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { friendlyRevertMessage } from "@/lib/revertMessage";

function stripTsComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("arena play surface copy (GitLab #318)", () => {
  const arenaSimplePage = stripTsComments(
    fs.readFileSync(path.resolve(__dirname, "ArenaSimplePage.tsx"), "utf8"),
  );
  const arenaWarbowPanel = stripTsComments(
    fs.readFileSync(path.resolve(__dirname, "ArenaWarbowHeroPanel.tsx"), "utf8"),
  );
  const saleSession = stripTsComments(
    fs.readFileSync(path.resolve(__dirname, "useArenaSaleSession.ts"), "utf8"),
  );

  it("forbids sale framing on the play console pre-launch copy", () => {
    expect(arenaSimplePage).not.toMatch(/\bsale\b/i);
    expect(arenaSimplePage).toContain("phaseNarrative(session.phase)");
  });

  it("wires WarBow rival rows to wallet profile modal (#258)", () => {
    expect(arenaWarbowPanel).toContain("onOpenWalletProfile?: (address: string) => void");
    expect(arenaWarbowPanel).toContain("onOpenProfile={onOpenWalletProfile}");
    expect(arenaSimplePage).toMatch(/<ArenaWarbowHeroPanel[\s\S]*onOpenWalletProfile=\{onOpenWalletProfile\}/);
  });

  it("keeps sale wording out of play-session user errors", () => {
    expect(saleSession).not.toMatch(/setBuyError\([^)]*\bsale\b/i);
  });

  it("maps TimeArena revert copy without sale framing", () => {
    expect(friendlyRevertMessage("timearena: not started")).toBe("The arena has not opened yet.");
    expect(friendlyRevertMessage("timearena: timer expired")).toBe("The round timer has expired.");
    expect(friendlyRevertMessage("timearenabuyrouter__badphase")).toBe(
      "Arena buys are not open right now (pre-launch, paused, or past the timer).",
    );
    for (const msg of [
      friendlyRevertMessage("timearena: not started"),
      friendlyRevertMessage("timearena: timer expired"),
      friendlyRevertMessage("timearenabuyrouter__badphase"),
    ]) {
      expect(msg).not.toMatch(/\bsale\b/i);
    }
  });
});

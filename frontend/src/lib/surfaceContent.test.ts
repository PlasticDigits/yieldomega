// SPDX-License-Identifier: AGPL-3.0-only

import { describe, expect, it } from "vitest";
import {
  HOME_HERO_SIGNALS,
  HOME_SURFACE_CARDS,
  LAUNCH_COUNTDOWN_LINKS,
  LAUNCH_COUNTDOWN_SIGNALS,
} from "./surfaceContent";

describe("HOME_SURFACE_CARDS", () => {
  it("points the primary home card at / (GitLab #243)", () => {
    const arena = HOME_SURFACE_CARDS.find((c) => c.title === "Time Arena");
    expect(arena?.to).toBe("/");
  });

  it("uses current Time Arena command-console copy for the primary card (GitLab #290)", () => {
    const arena = HOME_SURFACE_CARDS.find((c) => c.title === "Time Arena");
    expect(arena?.blurb).toBe("Buy CHARM, pressure four timers, fight for DOUB podiums.");
    expect(arena?.imageAlt).toContain("command-console");
    expect(arena?.imageAlt).not.toMatch(/fair-launch|arcade/i);
  });

  it("surfaces immediate play, audit, referral, and venue decisions (GitLab #295)", () => {
    expect(HOME_SURFACE_CARDS.map((c) => [c.title, c.to])).toEqual([
      ["Time Arena", "/"],
      ["Arena AUDIT", "/audit"],
      ["Referrals", "/referrals"],
      ["Kumbaya", "/kumbaya"],
      ["Sir", "/sir"],
    ]);
  });

  it("keeps stale sale, TimeCurve, PvE, and worldbuilding copy out of entry surfaces (GitLab #295)", () => {
    const copy = [
      ...HOME_HERO_SIGNALS.flatMap((signal) => [signal.label, signal.tooltip]),
      ...HOME_SURFACE_CARDS.flatMap((card) => [
        card.title,
        card.blurb,
        card.imageAlt,
        card.badgeLabel,
        card.tooltip,
      ]),
      ...LAUNCH_COUNTDOWN_SIGNALS.flatMap((signal) => [signal.label, signal.tooltip]),
      ...LAUNCH_COUNTDOWN_LINKS.flatMap((link) => [link.label, link.tooltip]),
    ].join(" ");

    expect(copy).not.toMatch(/\bTimeCurve\b|\bsale\b|sale-end|redeem|redemption|launchpad|worldbuilding|\bPvE\b/i);
  });
});

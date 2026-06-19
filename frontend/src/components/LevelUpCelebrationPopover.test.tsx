// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useReducedMotionMock = vi.fn(() => false);
const markFeatureTutorialSeen = vi.fn();

vi.mock("motion/react", () => ({
  useReducedMotion: () => useReducedMotionMock(),
}));

vi.mock("@/lib/arenaProgression", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/arenaProgression")>();
  return {
    ...actual,
    markFeatureTutorialSeen: (feature: string) => markFeatureTutorialSeen(feature),
  };
});

vi.mock("canvas-confetti", () => ({
  default: {
    create: () => vi.fn(),
  },
}));

import { LevelUpCelebrationPopover } from "./LevelUpCelebrationPopover";

describe("LevelUpCelebrationPopover", () => {
  beforeEach(() => {
    useReducedMotionMock.mockReturnValue(false);
  });

  afterEach(() => {
    markFeatureTutorialSeen.mockClear();
    vi.clearAllMocks();
  });

  it("renders glass popover with unlock line when feature is set", () => {
    const html = renderToStaticMarkup(
      createElement(LevelUpCelebrationPopover, {
        feature: "time_booster",
        onDismiss: () => {},
      }),
    );
    expect(html).toContain('data-testid="level-up-celebration"');
    expect(html).toContain('data-testid="level-up-celebration-panel"');
    expect(html).toContain("Level Up");
    expect(html).toContain("Time Booster unlocked");
    expect(html).toContain('data-testid="level-up-celebration-confetti"');
  });

  it("omits confetti canvas when reduced motion is preferred", () => {
    useReducedMotionMock.mockReturnValue(true);
    const html = renderToStaticMarkup(
      createElement(LevelUpCelebrationPopover, {
        feature: "warbow",
        onDismiss: () => {},
      }),
    );
    expect(html).toContain('data-reduced-motion="true"');
    expect(html).not.toContain('data-testid="level-up-celebration-confetti"');
  });

  it("renders nothing when feature is null", () => {
    const html = renderToStaticMarkup(
      createElement(LevelUpCelebrationPopover, {
        feature: null,
        onDismiss: () => {},
      }),
    );
    expect(html).toBe("");
  });
});

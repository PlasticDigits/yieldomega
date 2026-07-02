// SPDX-License-Identifier: AGPL-3.0-only

import { createElement, useState } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import {
  ArenaTimerPodiumCarousel,
  type ArenaTimerPodiumCarouselProps,
} from "./ArenaTimerPodiumCarousel";
import { normalizeTimerPodiumSlideIndex } from "./timerPodiumCarouselSlots";
import { isTimerPodiumSlideLocked } from "./useTimerPodiumSlideMeta";

import type { PodiumReadRow } from "./usePodiumReads";

const ALICE = "0x1111111111111111111111111111111111111111" as const;
const BOB = "0x2222222222222222222222222222222222222222" as const;
const CAROL = "0x3333333333333333333333333333333333333333" as const;

const podiumRows: PodiumReadRow[] = [
  {
    winners: [ALICE, BOB, CAROL],
    values: ["3", "2", "1"],
    winnerBuySec: ["1700000000", "1699999990", "1699999980"],
    epoch: "12",
  },
  { winners: [BOB, ALICE, CAROL], values: ["900", "700", "500"], epoch: "4" },
  { winners: [CAROL, BOB, ALICE], values: ["12", "8", "4"], epoch: "2" },
  { winners: [ALICE, CAROL, BOB], values: ["4000", "3000", "2000"], epoch: "7" },
];

function renderCarousel(overrides: Partial<ArenaTimerPodiumCarouselProps> = {}): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      createElement(ArenaTimerPodiumCarousel, {
        activeIndex: 0,
        onActiveIndexChange: () => {},
        decimals: 18,
        podiumRows,
        podiumPayoutPreview: [
          { places: ["1600000000000000000", "800000000000000000", "600000000000000000"] },
          { places: ["900000000000000000000", "700000000000000000000", "500000000000000000000"] },
          { places: ["12000000000000000000", "8000000000000000000", "4000000000000000000"] },
          { places: ["4000000000000000000000", "3000000000000000000000", "2000000000000000000000"] },
        ],
        locked: false,
        lockedForConnection: false,
        requiredLevel: 1,
        categoryIndex: 0,
        ...overrides,
      }),
    ),
  );
}

describe("timerPodiumCarouselSlots", () => {
  it("wraps slide indices across four podiums", () => {
    expect(normalizeTimerPodiumSlideIndex(-1)).toBe(3);
    expect(normalizeTimerPodiumSlideIndex(4)).toBe(0);
  });
});

describe("isTimerPodiumSlideLocked", () => {
  it("locks only the immediate next unlock tier (#334)", () => {
    expect(isTimerPodiumSlideLocked(0, 1, true, 1)).toBe(false);
    expect(isTimerPodiumSlideLocked(1, 2, true, 1)).toBe(true);
    expect(isTimerPodiumSlideLocked(2, 3, true, 1)).toBe(false);
    expect(isTimerPodiumSlideLocked(3, 4, true, 3)).toBe(true);
    expect(isTimerPodiumSlideLocked(3, 4, true, 4)).toBe(false);
    expect(isTimerPodiumSlideLocked(3, 4, false, undefined)).toBe(false);
  });
});

describe("ArenaTimerPodiumCarousel", () => {
  it("renders carets, dots, and the active podium leaderboard", () => {
    const html = renderCarousel();
    expect(html).toContain('data-testid="arena-timer-podium-carousel"');
    expect(html).toContain('data-testid="arena-timer-podium-carousel-prev"');
    expect(html).toContain('data-testid="arena-timer-podium-carousel-next"');
    expect(html).toContain('data-testid="arena-timer-podium-carousel-dot-0"');
    expect(html).toContain('data-testid="arena-timer-podium-carousel-dot-3"');
    expect(html).toContain('data-testid="arena-last-buy-podium-leaderboard"');
    expect(html).toContain("arena-simple__timer-podium-carousel-dot--active");
  });

  it("keeps chrome-surface layout spacers for panel-level lock alignment", () => {
    const html = renderCarousel({
      surface: "chrome",
      panelHeader: createElement("div", { "data-testid": "timer-panel-header" }, "Timer hero"),
    });
    expect(html).toContain("arena-simple__timer-podium-carousel--chrome");
    expect(html).toContain("arena-simple__timer-podium-carousel-chrome-layout");
    expect(html).toContain('data-testid="timer-panel-header"');
    expect(html).toContain('data-testid="arena-timer-podium-carousel-prev"');
    expect(html).not.toContain('data-testid="arena-timer-podium-carousel"');
  });

  it("shows a lock overlay when the viewer level is too low", () => {
    const html = renderCarousel({
      activeIndex: 3,
      categoryIndex: 1,
      requiredLevel: 4,
      locked: true,
      lockedForConnection: false,
      panelHeader: createElement("div", { "data-testid": "timer-panel-header" }, "Timer hero"),
    });
    expect(html).toContain('data-testid="arena-timer-podium-lock-1"');
    expect(html).toContain("LEVEL 4");
    expect(html).toContain('data-testid="timer-panel-header"');
    expect(html).toContain('data-testid="arena-timer-podium-carousel-prev"');
    expect(html).toContain('data-testid="arena-timer-podium-carousel-dot-3"');
  });

  it("switches category index when the active slide changes", () => {
    function Harness() {
      const [index, setIndex] = useState(2);
      return createElement(ArenaTimerPodiumCarousel, {
        activeIndex: index,
        onActiveIndexChange: setIndex,
        decimals: 18,
        podiumRows,
        locked: false,
        lockedForConnection: false,
        requiredLevel: 3,
        categoryIndex: 2,
      });
    }

    const html = renderToStaticMarkup(
      createElement(MemoryRouter, { initialEntries: ["/"] }, createElement(Harness)),
    );
    expect(html).toContain('data-podium-category="2"');
  });
});

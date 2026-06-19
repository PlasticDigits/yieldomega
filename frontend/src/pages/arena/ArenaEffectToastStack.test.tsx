// SPDX-License-Identifier: AGPL-3.0-only

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  ARENA_BUY_EFFECT_TOAST_DISMISS_MS,
  ARENA_BUY_EFFECT_TOAST_STAGGER_MS,
} from "./arenaBuyEffectToastLines";
import { ArenaEffectToastStack } from "./ArenaEffectToastStack";

vi.mock("motion/react", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  motion: {
    div: ({ children, ...props }: { children: React.ReactNode }) =>
      createElement("div", props, children),
  },
  useReducedMotion: () => true,
}));

describe("ArenaEffectToastStack (#337)", () => {
  it("renders one toast per effect line with shared test id", () => {
    const html = renderToStaticMarkup(
      createElement(ArenaEffectToastStack, {
        toasts: [
          { id: "1", line: "+3xp" },
          { id: "2", line: "+120s" },
        ],
        onDismiss: () => {},
        reduceMotion: true,
      }),
    );
    expect(html).toContain('data-testid="arena-buy-effect-toast-stack"');
    expect(html.match(/data-testid="arena-buy-effect-toast"/g)).toHaveLength(2);
    expect(html).toContain("+3xp");
    expect(html).toContain("+120s");
    expect(html).toContain("arena-buy-effect-toast--xp");
    expect(html).toContain("arena-buy-effect-toast--timer");
  });

  it("documents auto-dismiss and stagger timing for reduced-motion clients", () => {
    expect(ARENA_BUY_EFFECT_TOAST_DISMISS_MS).toBeGreaterThanOrEqual(3000);
    expect(ARENA_BUY_EFFECT_TOAST_DISMISS_MS).toBeLessThanOrEqual(5000);
    expect(ARENA_BUY_EFFECT_TOAST_STAGGER_MS).toBeGreaterThan(0);
  });
});

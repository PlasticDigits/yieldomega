// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Tone = "default" | "live" | "gold" | "purple";

type Props = {
  children: ReactNode;
  className?: string;
  tone?: Tone;
};

export function GlassPanel({ children, className, tone = "default" }: Props) {
  const toneClass =
    tone === "live"
      ? "glass-panel--live"
      : tone === "gold"
        ? "glass-panel--gold"
        : tone === "purple"
          ? "glass-panel--purple"
          : "";
  const classes = ["glass-panel", toneClass, className].filter(Boolean).join(" ");
  return <div className={classes}>{children}</div>;
}

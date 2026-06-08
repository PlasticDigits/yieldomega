// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Tone = "default" | "live" | "gold" | "purple";

type Props = {
  children: ReactNode;
  tone?: Tone;
  className?: string;
};

export function GlassStatus({ children, tone = "default", className }: Props) {
  const toneClass =
    tone === "live"
      ? "glass-status--live"
      : tone === "gold"
        ? "glass-status--gold"
        : tone === "purple"
          ? "glass-status--purple"
          : "";
  const classes = ["glass-status", toneClass, className].filter(Boolean).join(" ");
  return <span className={classes}>{children}</span>;
}

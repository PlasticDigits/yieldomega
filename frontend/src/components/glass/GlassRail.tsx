// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  label?: string;
};

export function GlassRail({ children, className, label = "Secondary Arena operations" }: Props) {
  const classes = ["glass-rail", "arena-command-console__side", className]
    .filter(Boolean)
    .join(" ");
  return (
    <aside className={classes} aria-label={label}>
      {children}
    </aside>
  );
}

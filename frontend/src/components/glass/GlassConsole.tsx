// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  ambient?: boolean;
};

/** Primary glass arena console surface (timer + buy + rails). */
export function GlassConsole({ children, className, ambient = true }: Props) {
  const classes = ["glass-arena-console", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      {ambient ? <div className="arena-command-console__ambient" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}

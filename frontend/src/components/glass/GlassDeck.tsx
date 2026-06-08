// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "data-testid"?: string;
};

export function GlassDeck({
  children,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "data-testid": testId,
}: Props) {
  const classes = ["glass-deck", "arena-command-console__primary", className]
    .filter(Boolean)
    .join(" ");
  return (
    <section
      className={classes}
      id={id}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      data-testid={testId}
    >
      {children}
    </section>
  );
}

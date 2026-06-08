// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  title: string;
  titleId: string;
  children: ReactNode;
  className?: string;
};

/** Timer bay wrapper for Last Buy / pre-open countdown. */
export function CountdownDisplay({ title, titleId, children, className }: Props) {
  const classes = ["arena-command-console__timer-bay", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <h2 id={titleId} className="arena-command-console__timer-title">
        {title}
      </h2>
      {children}
    </div>
  );
}

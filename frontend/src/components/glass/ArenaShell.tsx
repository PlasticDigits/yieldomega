// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  /** Homepage `/` play-first layout — tighter top spacing. */
  playFirst?: boolean;
  testId?: string;
};

/** Physical arena console page frame for YieldOmega Glass Arena. */
export function ArenaShell({ children, className, playFirst = false, testId }: Props) {
  const classes = [
    "yga-arena-shell",
    playFirst ? "yga-arena-shell--play-first" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} data-testid={testId}>
      {children}
    </div>
  );
}

// SPDX-License-Identifier: AGPL-3.0-only

import type { HTMLAttributes, ReactNode } from "react";

type Props = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
};

/** Live buy / last extension chip with pulse dot. */
export function ActivePlayerIndicator({ children, className, ...rest }: Props) {
  const classes = ["yga-active-player", className].filter(Boolean).join(" ");
  return (
    <span className={classes} aria-live="polite" {...rest}>
      <span className="yga-active-player__dot" aria-hidden="true" />
      {children}
    </span>
  );
}

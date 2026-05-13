// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Optional explicit accessible name when `children` is not plain text. */
  "aria-label"?: string;
};

/**
 * User-visible copy when a stat or chart slot has no meaningful value yet.
 * Prefer this over a bare em dash so empty states read as intentional ([GitLab #200](https://gitlab.com/PlasticDigits/yieldomega/-/issues/200)).
 */
export function EmptyDataPlaceholder({ children, ...rest }: Props) {
  return (
    <span className="empty-data-placeholder" role="status" {...rest}>
      {children}
    </span>
  );
}

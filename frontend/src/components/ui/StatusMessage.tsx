// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";

type Variant = "muted" | "placeholder" | "error" | "loading";

type Props = {
  variant?: Variant;
  children: ReactNode;
  className?: string;
};

export function StatusMessage({ variant = "muted", children, className }: Props) {
  if (variant === "loading") {
    const classes = ["loading-state", className].filter(Boolean).join(" ");
    return (
      <div className={classes}>
        <img
          src="/art/icons/loading-mascot-ring.png"
          alt=""
          width={96}
          height={96}
          decoding="async"
        />
        <p>{children}</p>
      </div>
    );
  }

  const variantClass =
    variant === "error" ? "error-text" : variant === "placeholder" ? "placeholder" : "muted";
  const classes = [variantClass, className].filter(Boolean).join(" ");
  return <p className={classes}>{children}</p>;
}

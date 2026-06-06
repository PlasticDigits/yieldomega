// SPDX-License-Identifier: AGPL-3.0-only

import type { HTMLAttributes, ReactNode } from "react";

type Variant = "muted" | "placeholder" | "error" | "warning" | "loading";

type Props = {
  variant?: Variant;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children">;

export function StatusMessage({ variant = "muted", children, className, ...rest }: Props) {
  if (variant === "loading") {
    const classes = ["loading-state", className].filter(Boolean).join(" ");
    return (
      <div className={classes} {...rest}>
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
    variant === "error"
      ? "error-text"
      : variant === "warning"
        ? "warning-text"
        : variant === "placeholder"
          ? "placeholder"
          : "muted";
  const classes = [variantClass, className].filter(Boolean).join(" ");
  return <p className={classes} {...rest}>{children}</p>;
}

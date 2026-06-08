// SPDX-License-Identifier: AGPL-3.0-only

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: Variant;
  loading?: boolean;
};

/** Arena buy / claim / guard action button with glass styling. */
export function ArenaActionButton({
  children,
  variant = "primary",
  loading = false,
  className,
  disabled,
  ...rest
}: Props) {
  const variantClass =
    variant === "secondary"
      ? "btn-secondary"
      : variant === "danger"
        ? "btn-danger"
        : "btn-primary";
  const classes = ["arena-action-btn", variantClass, className].filter(Boolean).join(" ");
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {children}
    </button>
  );
}

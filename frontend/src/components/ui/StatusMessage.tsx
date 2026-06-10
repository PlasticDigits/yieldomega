// SPDX-License-Identifier: AGPL-3.0-only

import type { HTMLAttributes, ReactNode } from "react";

type Variant = "muted" | "placeholder" | "error" | "warning" | "loading";

type DataAttributes = {
  [key: `data-${string}`]: string | number | boolean | undefined;
};

type Props = {
  variant?: Variant;
  children: ReactNode;
} & Omit<HTMLAttributes<HTMLElement>, "children"> & DataAttributes;

const VARIANT_CLASS: Record<Exclude<Variant, "loading">, string> = {
  muted: "status-message--muted muted",
  placeholder: "status-message--placeholder placeholder",
  error: "status-message--error error-text",
  warning: "status-message--warning warning-text",
};

export function StatusMessage({ variant = "muted", children, className, ...rest }: Props) {
  if (variant === "loading") {
    const classes = ["status-message", "status-message--loading", "loading-state", className]
      .filter(Boolean)
      .join(" ");
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

  const classes = ["status-message", VARIANT_CLASS[variant], className].filter(Boolean).join(" ");
  return (
    <p className={classes} {...rest}>
      {children}
    </p>
  );
}

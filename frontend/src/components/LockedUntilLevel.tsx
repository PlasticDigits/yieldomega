// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { lockedUntilLevelCopy } from "@/lib/arenaProgression";

const LOCK_ICON_SRC = "/art/icons/arena-lock-level.png?v=glass1";

type Props = {
  requiredLevel: number;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  overlayTestId?: string;
  testId?: string;
  detail?: ReactNode;
  action?: ReactNode;
  variant?: "panel" | "compact";
};

export function LockedUntilLevel({
  requiredLevel,
  children,
  className,
  contentClassName,
  overlayTestId,
  testId,
  detail,
  action,
  variant = "panel",
}: Props) {
  const copy = lockedUntilLevelCopy(requiredLevel);
  return (
    <div
      className={["locked-until-level", `locked-until-level--${variant}`, className]
        .filter(Boolean)
        .join(" ")}
      data-testid={testId}
      data-locked-level={requiredLevel}
      aria-disabled="true"
    >
      <div className={["locked-until-level__content", contentClassName].filter(Boolean).join(" ")} aria-hidden="true">
        {children}
      </div>
      <div className="locked-until-level__overlay" data-testid={overlayTestId} role="note" aria-label={copy}>
        <img
          className="locked-until-level__icon"
          src={LOCK_ICON_SRC}
          alt=""
          width={96}
          height={96}
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
        <strong>{copy}</strong>
        {detail ? <span>{detail}</span> : null}
        {action ? <span className="locked-until-level__action">{action}</span> : null}
      </div>
    </div>
  );
}

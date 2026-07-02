// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { LevelLockIcon } from "@/components/LevelLockIcon";
import { lockedUntilLevelCopy } from "@/lib/arenaProgression";

type Props = {
  requiredLevel: number;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  overlayTestId?: string;
  testId?: string;
  /** Overrides default “LEVEL N” headline. */
  title?: ReactNode;
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
  title,
  detail,
  action,
  variant = "panel",
}: Props) {
  const copy = title ?? lockedUntilLevelCopy(requiredLevel);
  const ariaLabel = typeof copy === "string" ? copy : lockedUntilLevelCopy(requiredLevel);
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
      <div className="locked-until-level__overlay" data-testid={overlayTestId} role="note" aria-label={ariaLabel}>
        <div className="locked-until-level__headline">
          <LevelLockIcon className="locked-until-level__icon" />
          <strong>{copy}</strong>
        </div>
        {detail ? <span>{detail}</span> : null}
        {action ? <span className="locked-until-level__action">{action}</span> : null}
      </div>
    </div>
  );
}

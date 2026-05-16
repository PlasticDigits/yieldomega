// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageBadge, type PageBadgeTone } from "@/components/ui/PageBadge";

type Props = {
  /** When omitted, no `<h2>` is rendered (badge + lede may still show). */
  title?: string;
  lede?: ReactNode;
  badgeLabel?: string;
  badgeTone?: PageBadgeTone;
  spotlight?: boolean;
  className?: string;
  id?: string;
  dataTestId?: string;
  children: ReactNode;
  actions?: ReactNode;
  cutout?: {
    src: string;
    width: number;
    height: number;
    className: string;
  };
};

export function PageSection({
  title,
  lede,
  badgeLabel,
  badgeTone = "info",
  spotlight = false,
  className,
  id,
  dataTestId,
  children,
  actions,
  cutout,
}: Props) {
  const classes = [
    "data-panel",
    spotlight ? "data-panel--spotlight" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const hasTitle = Boolean(title);
  const hasLede = Boolean(lede);
  const hasCopyBody = hasTitle || hasLede;
  const hasBadge = Boolean(badgeLabel);
  const hasActions = Boolean(actions);
  /** Badge alone (no title/lede/actions): skip `section-heading` so panel chrome can stay on the outer `data-panel`. */
  const badgeStandalone = hasBadge && !hasCopyBody && !hasActions;
  const showHeaderChrome = hasBadge || hasCopyBody || hasActions;

  return (
    <section id={id} className={classes} data-testid={dataTestId}>
      {cutout && (
        <CutoutDecoration
          className={cutout.className}
          src={cutout.src}
          width={cutout.width}
          height={cutout.height}
        />
      )}
      {showHeaderChrome ? (
        badgeStandalone ? (
          <div className="page-section__standalone-badge">
            {badgeLabel ? <PageBadge label={badgeLabel} tone={badgeTone} /> : null}
          </div>
        ) : (
          <div className="section-heading">
            {hasCopyBody ? (
              <div className="section-heading__copy">
                {badgeLabel ? <PageBadge label={badgeLabel} tone={badgeTone} /> : null}
                {hasTitle ? <h2>{title}</h2> : null}
                {hasLede ? <div className="section-heading__lede">{lede}</div> : null}
              </div>
            ) : badgeLabel ? (
              <PageBadge label={badgeLabel} tone={badgeTone} />
            ) : null}
            {hasActions ? <div className="section-heading__actions">{actions}</div> : null}
          </div>
        )
      ) : null}
      {children}
    </section>
  );
}

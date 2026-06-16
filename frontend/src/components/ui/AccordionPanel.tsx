// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { PageBadge, type PageBadgeTone } from "@/components/ui/PageBadge";

type Props = {
  badgeLabel: string;
  badgeTone?: PageBadgeTone;
  title: string;
  lede?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Collapsible glass panel — same chrome as AUDIT `RawDataAccordion` ([`ArenaSections.tsx`](../pages/arena/ArenaSections.tsx)). */
export function AccordionPanel({
  badgeLabel,
  badgeTone = "info",
  title,
  lede,
  className,
  children,
}: Props) {
  const classes = ["data-panel", "accordion-panel", className].filter(Boolean).join(" ");

  return (
    <details className={classes}>
      <summary>
        <div className="section-heading__copy">
          <PageBadge label={badgeLabel} tone={badgeTone} />
          <h2>{title}</h2>
          {lede ? <div className="section-heading__lede">{lede}</div> : null}
        </div>
      </summary>
      <div className="accordion-panel__content">{children}</div>
    </details>
  );
}

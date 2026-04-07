// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from "react";
import { CutoutDecoration } from "@/components/CutoutDecoration";
import { PageBadge, type PageBadgeTone } from "@/components/ui/PageBadge";

type Props = {
  title: string;
  lede?: ReactNode;
  badgeLabel?: string;
  badgeTone?: PageBadgeTone;
  spotlight?: boolean;
  className?: string;
  id?: string;
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

  return (
    <section id={id} className={classes}>
      {cutout && (
        <CutoutDecoration
          className={cutout.className}
          src={cutout.src}
          width={cutout.width}
          height={cutout.height}
        />
      )}
      <div className="section-heading">
        <div className="section-heading__copy">
          {badgeLabel && <PageBadge label={badgeLabel} tone={badgeTone} />}
          <h2>{title}</h2>
          {lede && <div className="section-heading__lede">{lede}</div>}
        </div>
        {actions && <div className="section-heading__actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

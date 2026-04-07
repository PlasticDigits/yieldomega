// SPDX-License-Identifier: AGPL-3.0-only

export type PageBadgeTone = "live" | "soon" | "external" | "warning" | "info";

type Props = {
  label: string;
  tone?: PageBadgeTone;
  className?: string;
};

export function PageBadge({ label, tone = "info", className }: Props) {
  const classes = ["ui-badge", `ui-badge--${tone}`, className].filter(Boolean).join(" ");
  return <span className={classes}>{label}</span>;
}

// SPDX-License-Identifier: AGPL-3.0-only

export type PageBadgeTone = "live" | "soon" | "external" | "warning" | "info";

type Props = {
  label: string;
  tone?: PageBadgeTone;
  className?: string;
  /**
   * Optional issue-#45 status pictogram. When supplied the icon renders before
   * the label and is announced as decorative (`aria-hidden`); the visible label
   * remains the source of truth for assistive tech (per
   * `docs/frontend/design.md` accessibility baseline).
   * See [`frontend/public/art/icons/`](../../../public/art/icons/) and the
   * status icon list in
   * [`frontend/public/art/README.md`](../../../public/art/README.md).
   */
  iconSrc?: string;
};

export function PageBadge({ label, tone = "info", className, iconSrc }: Props) {
  const classes = [
    "ui-badge",
    `ui-badge--${tone}`,
    iconSrc ? "ui-badge--with-icon" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={classes}>
      {iconSrc && (
        <img
          className="ui-badge__icon"
          src={iconSrc}
          alt=""
          width={16}
          height={16}
          aria-hidden="true"
          loading="lazy"
          decoding="async"
        />
      )}
      <span className="ui-badge__label">{label}</span>
    </span>
  );
}

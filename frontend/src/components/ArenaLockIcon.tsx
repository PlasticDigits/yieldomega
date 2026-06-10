// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  className?: string;
  title?: string;
};

/** Compact padlock glyph for progression tier locks (SVG fallback when art PNG is absent). */
export function ArenaLockIcon({ className, title }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      width={16}
      height={16}
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill="currentColor"
        d="M4.5 7V5.25a3.75 3.75 0 1 1 7.5 0V7h.75A1.25 1.25 0 0 1 14 8.25v5.5A1.25 1.25 0 0 1 12.75 15h-9.5A1.25 1.25 0 0 1 2 13.75v-5.5A1.25 1.25 0 0 1 3.25 7H4.5Zm1.5 0h4V5.25a2 2 0 1 0-4 0V7Z"
      />
    </svg>
  );
}

// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  className?: string;
};

/** Flat cyan lock glyph for level gates. */
export function LevelLockIcon({ className }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={24}
      height={24}
      aria-hidden
      focusable="false"
    >
      <path
        d="M8 10V7.35C8 5.1 9.78 3.45 12 3.45s4 1.65 4 3.9V10"
        fill="none"
        stroke="#2f8fd4"
        strokeWidth="2.15"
        strokeLinecap="round"
      />
      <rect
        x="5.35"
        y="9.35"
        width="13.3"
        height="10.9"
        rx="1.85"
        fill="currentColor"
        stroke="#2f8fd4"
        strokeWidth="1.7"
      />
      <path
        d="M7.7 12.05h8.6v5.95H7.7z"
        fill="#bff8ff"
        fillOpacity="0.45"
      />
      <path
        d="M12 13.45v3.15"
        fill="none"
        stroke="#06384f"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

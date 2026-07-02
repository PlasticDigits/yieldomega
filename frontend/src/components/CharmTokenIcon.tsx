// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  className?: string;
  width?: number;
  height?: number;
};

/** Flat CHARM glyph rendered inline so it stays crisp at every token size. */
export function CharmTokenIcon({ className, width = 18, height = 18 }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={width}
      height={height}
      aria-hidden
      focusable="false"
    >
      <circle cx="12" cy="12" r="11" fill="#092f24" />
      <circle cx="12" cy="12" r="10.2" fill="#123d2f" stroke="#6df0a7" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="#eaffef" strokeOpacity="0.24" strokeWidth="1" />
      <path
        d="M12 11.35C10.6 8.95 8.42 6.9 6.5 8.44C4.55 10 6.9 12.05 11.18 12.05C8.95 13.44 6.9 15.62 8.44 17.54C10 19.49 12.05 17.14 12.05 12.86C13.44 15.09 15.62 17.14 17.54 15.6C19.49 14.04 17.14 11.99 12.86 11.99C15.09 10.6 17.14 8.42 15.6 6.5C14.04 4.55 11.99 6.9 11.99 11.18"
        fill="#48dc78"
      />
      <path
        d="M12 12.05C10.15 10.2 9 8.28 9.98 7.16C10.68 6.35 11.55 6.82 12 8.28C12.45 6.82 13.32 6.35 14.02 7.16C15 8.28 13.85 10.2 12 12.05ZM12 12.05C10.15 13.9 8.28 15 7.16 14.02C6.35 13.32 6.82 12.45 8.28 12C6.82 11.55 6.35 10.68 7.16 9.98C8.28 9 10.15 10.2 12 12.05ZM12 12.05C13.85 10.2 15.72 9 16.84 9.98C17.65 10.68 17.18 11.55 15.72 12C17.18 12.45 17.65 13.32 16.84 14.02C15.72 15 13.85 13.9 12 12.05ZM12 12.05C13.85 13.9 15 15.72 14.02 16.84C13.32 17.65 12.45 17.18 12 15.72C11.55 17.18 10.68 17.65 9.98 16.84C9 15.72 10.15 13.9 12 12.05Z"
        fill="#7dff9c"
        fillOpacity="0.72"
      />
      <path
        d="M12 12.45C11.72 14.05 11.78 15.46 12.28 16.76"
        fill="none"
        stroke="#2bb75e"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.15" fill="#eaffef" />
    </svg>
  );
}

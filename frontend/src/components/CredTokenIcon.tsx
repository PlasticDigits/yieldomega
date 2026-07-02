// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  className?: string;
  width?: number;
  height?: number;
};

/** Flat Play CRED glyph — replaces legacy `cred.png` art everywhere. */
export function CredTokenIcon({ className, width = 18, height = 18 }: Props) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={width}
      height={height}
      aria-hidden
      focusable="false"
    >
      <circle cx="12" cy="12" r="11" fill="currentColor" />
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="#0b6b5f" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="8.25" fill="none" stroke="#e8fff7" strokeOpacity="0.34" strokeWidth="1" />
      <path
        d="M15.85 8.25C15.02 7.42 13.88 6.92 12.55 6.92C9.73 6.92 7.65 9.05 7.65 12C7.65 14.95 9.73 17.08 12.55 17.08C13.9 17.08 15.07 16.58 15.92 15.72"
        fill="none"
        stroke="#052b24"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

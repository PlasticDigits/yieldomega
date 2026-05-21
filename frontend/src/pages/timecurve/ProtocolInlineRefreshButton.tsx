// SPDX-License-Identifier: AGPL-3.0-only

export function ProtocolInlineRefreshButton({
  ariaLabel,
  disabled,
  onClick,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="timecurve-protocol__inline-refresh"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
    >
      {disabled ? "…" : "↻"}
    </button>
  );
}

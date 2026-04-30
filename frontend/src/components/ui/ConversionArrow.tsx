// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Canonical “A → B” conversion glyph for TimeCurve pay rails and fee sinks.
 * Source: `/art/icons/ui-conversion-arrow.svg`. Optional Replicate refresh:
 * `scripts/replicate-art/ui_conversion_arrow_batch.py` (writes PNG under
 * `pending_manual_review/` for manual promotion if desired).
 */
export const CONVERSION_ARROW_SRC = "/art/icons/ui-conversion-arrow.svg";

type ConversionArrowProps = {
  /** Pixel width/height (square). */
  size?: number;
  className?: string;
};

export function ConversionArrow({ size = 14, className }: ConversionArrowProps) {
  return (
    <img
      src={CONVERSION_ARROW_SRC}
      alt=""
      width={size}
      height={size}
      decoding="async"
      className={className}
      aria-hidden
    />
  );
}

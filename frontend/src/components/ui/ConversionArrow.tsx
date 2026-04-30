// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Canonical “A → B” conversion glyph for TimeCurve pay rails and fee sinks.
 * Source: `/art/icons/ui-conversion-arrow.png` (Replicate gpt-image-2; regenerate via
 * `scripts/replicate-art/ui_conversion_arrow_batch.py`, or `--fetch-prediction-id` for an existing run).
 */
export const CONVERSION_ARROW_SRC = "/art/icons/ui-conversion-arrow.png";

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

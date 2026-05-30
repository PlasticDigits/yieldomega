// SPDX-License-Identifier: AGPL-3.0-only

import type { CSSProperties, ComponentPropsWithoutRef } from "react";

function sliderFillPercent(value: number, min: number, max: number): number {
  if (max <= min) return 0;
  const t = (value - min) / (max - min);
  return Math.min(100, Math.max(0, t * 100));
}

export type ArenaBuySpendRangeInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "className" | "style" | "type"
> & {
  className?: string;
  style?: CSSProperties;
};

/**
 * Native range control for CL8Y spend permille (or any min/max) with the shared
 * Time Arena buy-hub track + knob styling (see `.arena-buy-spend-range` in `index.css`).
 */
export function ArenaBuySpendRangeInput({
  className,
  style,
  min = 0,
  max = 10000,
  value,
  ...rest
}: ArenaBuySpendRangeInputProps) {
  const minN = typeof min === "string" ? Number(min) : min;
  const maxN = typeof max === "string" ? Number(max) : max;
  const valueN = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  const fillPct = sliderFillPercent(Number.isFinite(valueN) ? valueN : 0, minN, maxN);

  return (
    <input
      {...rest}
      type="range"
      min={min}
      max={max}
      value={value}
      className={["form-input", "arena-buy-spend-range", className].filter(Boolean).join(" ")}
      style={
        {
          "--arena-buy-spend-fill": `${fillPct}%`,
          ...style,
        } as CSSProperties
      }
    />
  );
}

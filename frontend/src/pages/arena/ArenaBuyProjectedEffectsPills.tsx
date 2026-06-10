// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  lines: readonly string[];
  className?: string;
  lineClassName?: string;
  itemClassName?: string;
  testId?: string;
  ariaLabel?: string;
};

/** Shared pill rail for projected buy effects near the checkout CTA. */
export function ArenaBuyProjectedEffectsPills({
  lines,
  className = "arena-simple__buy-preview-line",
  lineClassName,
  itemClassName = "arena-simple__buy-preview-item",
  testId = "arena-simple-buy-preview",
  ariaLabel = "Projected buy effects",
}: Props) {
  if (lines.length === 0) return null;

  return (
    <p
      className={[className, lineClassName].filter(Boolean).join(" ")}
      aria-label={ariaLabel}
      data-testid={testId}
    >
      {lines.map((item, i) => (
        <span
          key={`${i}:${item}`}
          className={[
            itemClassName,
            item.includes("->") && item.endsWith("Level") ? "arena-simple__buy-preview-item--level" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {item}
        </span>
      ))}
    </p>
  );
}

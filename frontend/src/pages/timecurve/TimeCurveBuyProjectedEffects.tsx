// SPDX-License-Identifier: AGPL-3.0-only

type TimeCurveBuyProjectedEffectsProps = {
  items: readonly string[];
  className?: string;
};

/**
 * Checkout “projected effects” rail — light panel + pill list shared by Simple
 * and Arena buy hubs.
 */
export function TimeCurveBuyProjectedEffects({ items, className }: TimeCurveBuyProjectedEffectsProps) {
  if (items.length === 0) {
    return null;
  }
  return (
    <div
      className={["timecurve-buy-projected-effects", className].filter(Boolean).join(" ")}
      aria-label="Projected effects of this buy"
    >
      <div className="timecurve-buy-projected-effects__head">
        <img src="/art/icons/warbow-flag-20.png" alt="" width={20} height={20} decoding="async" />
        <span className="timecurve-buy-projected-effects__title">Projected effects</span>
      </div>
      <ul>
        {items.map((item, i) => (
          <li key={`${i}:${item}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

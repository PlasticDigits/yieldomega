// SPDX-License-Identifier: AGPL-3.0-only

import { formatCompactFromRaw } from "@/lib/compactNumberFormat";
import { buySizeColor } from "@/pages/timecurve/buySizeColor";

type Props = {
  /** 0.1 = displayed minimum envelope, 1 = max; null = unknown (no block time). */
  ratio: number | null;
  amountRaw: string;
  title?: string;
};

export function BuyEnvelopeMiniMeter({ ratio, amountRaw, title }: Props) {
  const t = ratio === null ? null : Math.max(0, Math.min(1, ratio));
  const amountLabel = `${formatCompactFromRaw(amountRaw, 18, { sigfigs: 3 })} CL8Y`;
  const meterTitle =
    title ??
    (t === null
      ? `Spent ${amountLabel}; band fill needs indexer block time on this buy`
      : `Spent ${amountLabel}; ~${Math.round(t * 100)}% of max gross band at that block`);

  return (
    <span className="buy-env-meter-wrap" title={meterTitle}>
      <span
        className={`buy-env-meter-track${t === null ? " buy-env-meter-track--unknown" : ""}`}
        aria-hidden
      >
        {t !== null ? (
          <span
            className="buy-env-meter-fill"
            style={{
              width: `${Math.max(6, t * 100)}%`,
              backgroundColor: buySizeColor(t),
            }}
          />
        ) : null}
      </span>
      <span className="buy-env-meter-label">{amountLabel}</span>
    </span>
  );
}

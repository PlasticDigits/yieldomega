// SPDX-License-Identifier: AGPL-3.0-only

type Props = {
  /** 0 = min envelope, 1 = max; null = unknown (no block time). */
  ratio: number | null;
  title?: string;
};

const R = 13;
const C = 2 * Math.PI * R;

function fillColor(ratio: number): string {
  const t = Math.max(0, Math.min(1, ratio));
  const h = 205 - t * 155;
  const s = 62 + t * 28;
  const l = 42 + t * 18;
  return `hsl(${h} ${s}% ${l}%)`;
}

export function BuyEnvelopeMiniPie({ ratio, title }: Props) {
  if (ratio === null) {
    return (
      <div
        className="buy-env-pie buy-env-pie--unknown"
        title={title ?? "Min/max band needs block time on this row"}
        aria-hidden
      />
    );
  }
  const t = Math.max(0, Math.min(1, ratio));
  const dash = t * C;
  const col = fillColor(t);
  return (
    <span
      className="buy-env-pie-wrap"
      title={title ?? `Spend ~${Math.round(t * 100)}% from min toward max gross at buy`}
    >
      <svg className="buy-env-pie" width="36" height="36" viewBox="0 0 36 36" aria-hidden>
      <circle
        cx="18"
        cy="18"
        r={R}
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="4"
      />
      <circle
        cx="18"
        cy="18"
        r={R}
        fill="none"
        stroke={col}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C}`}
        transform="rotate(-90 18 18)"
      />
      </svg>
    </span>
  );
}

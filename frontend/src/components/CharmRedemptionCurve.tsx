// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import { parseBigIntString } from "@/lib/formatAmount";

type CharmRedemptionCurveProps = {
  /** Base-10 smallest units (string keeps React dev/profiler JSON-safe). */
  totalRaised: string;
  totalTokensForSale: string;
  acceptedDecimals: number;
  launchedDecimals: number;
  userCharmWeight?: string;
  saleStarted: boolean;
};

/** Implied average accepted asset per 1 launched token at a given cumulative raised amount. */
function impliedAssetPerToken(
  raised: bigint,
  totalTokensForSale: bigint,
  acceptedDecimals: number,
  launchedDecimals: number,
): number {
  if (totalTokensForSale === 0n) {
    return 0;
  }
  const r = parseFloat(formatUnits(raised, acceptedDecimals));
  const t = parseFloat(formatUnits(totalTokensForSale, launchedDecimals));
  if (!(t > 0) || !Number.isFinite(r) || !Number.isFinite(t)) {
    return 0;
  }
  return r / t;
}

function ratioAlong(raised: bigint, xMax: bigint): number {
  if (xMax === 0n) {
    return 0;
  }
  return Number((raised * 1_000_000n) / xMax) / 1_000_000;
}

/**
 * Shows implied clearing price (accepted asset per launched token) vs total charm weight in the sale.
 * For fixed token supply, price scales linearly with total raised.
 */
export function CharmRedemptionCurve({
  totalRaised: totalRaisedStr,
  totalTokensForSale: totalTokensForSaleStr,
  acceptedDecimals,
  launchedDecimals,
  userCharmWeight: userCharmWeightStr,
  saleStarted,
}: CharmRedemptionCurveProps) {
  const totalRaised = parseBigIntString(totalRaisedStr);
  const totalTokensForSale = parseBigIntString(totalTokensForSaleStr);
  const userCharmWeight =
    userCharmWeightStr !== undefined ? parseBigIntString(userCharmWeightStr) : undefined;

  const W = 400;
  const H = 160;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xMax = totalRaised > 0n ? (totalRaised * 120n) / 100n : 1n;

  const yAtMax = impliedAssetPerToken(xMax, totalTokensForSale, acceptedDecimals, launchedDecimals);
  const yAtCurrent = impliedAssetPerToken(
    totalRaised,
    totalTokensForSale,
    acceptedDecimals,
    launchedDecimals,
  );
  const yMax = Math.max(yAtMax, yAtCurrent, 1e-18);

  if (!saleStarted || totalTokensForSale === 0n) {
    return (
      <p className="muted">Chart appears after the sale has started and tokens for sale are set.</p>
    );
  }

  const samples = 48;
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const raised = (xMax * BigInt(i)) / BigInt(samples);
    const y = impliedAssetPerToken(raised, totalTokensForSale, acceptedDecimals, launchedDecimals);
    const t = ratioAlong(raised, xMax);
    const px = padL + t * plotW;
    const py = padT + plotH - (y / yMax) * plotH;
    points.push(`${px},${py}`);
  }

  const dotX = padL + ratioAlong(totalRaised, xMax) * plotW;
  const dotY = padT + plotH - (yAtCurrent / yMax) * plotH;

  let userLineX: number | undefined;
  if (userCharmWeight !== undefined && userCharmWeight > 0n && xMax > 0n) {
    const ux = padL + ratioAlong(userCharmWeight, xMax) * plotW;
    if (Number.isFinite(ux) && ux >= padL && ux <= padL + plotW) {
      userLineX = ux;
    }
  }

  const summary =
    totalRaised === 0n
      ? "Implied average: — (no charm weight in the pool yet)"
      : `Implied average: ${yAtCurrent.toPrecision(6)} accepted asset per 1 launched token (live estimate; final at sale end).`;

  return (
    <div>
      <svg
        className="epoch-chart"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Implied asset per token versus total charm weight"
      >
        <rect
          x={padL}
          y={padT}
          width={plotW}
          height={plotH}
          fill="none"
          stroke="var(--border, #333)"
          strokeWidth="1"
          opacity={0.35}
        />
        <polyline fill="none" stroke="var(--line)" strokeWidth="2" points={points.join(" ")} />
        {totalRaised > 0n && (
          <circle cx={dotX} cy={dotY} r={5} fill="var(--accent, #c9a227)" stroke="var(--bg)" strokeWidth="2" />
        )}
        {userLineX !== undefined && (
          <line
            x1={userLineX}
            x2={userLineX}
            y1={padT}
            y2={padT + plotH}
            stroke="var(--muted-line, #666)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        )}
        <text x={padL} y={H - 6} fontSize="10" fill="currentColor" opacity={0.7}>
          0
        </text>
        <text x={padL + plotW - 40} y={H - 6} fontSize="10" fill="currentColor" opacity={0.7}>
          total charm weight →
        </text>
      </svg>
      <p className="muted" style={{ marginTop: "0.5rem" }}>
        {summary}
      </p>
      {userCharmWeight !== undefined && userCharmWeight > 0n && (
        <p className="muted">Dashed vertical line: your charm weight (share of pool).</p>
      )}
    </div>
  );
}

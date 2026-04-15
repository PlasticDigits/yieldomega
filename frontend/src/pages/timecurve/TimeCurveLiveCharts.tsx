// SPDX-License-Identifier: AGPL-3.0-only

import { formatUnits } from "viem";
import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  linearPriceWadFloat,
  maxGrossSpendAtFloat,
  minGrossSpendAtFloat,
} from "@/lib/timeCurveMath";
import { elapsedChartAxisMaxSeconds, formatElapsedHms } from "@/pages/timecurve/timeCurveSaleWindow";

const CHART_SAMPLES = 72;

type Point = {
  /** Seconds since sale start (x-axis). */
  elapsedSinceLaunch: number;
  priceHuman: number;
  minGrossHuman: number;
  maxGrossHuman: number;
};

function toHuman(raw: bigint, decimals: number): number {
  return Number.parseFloat(formatUnits(raw, decimals));
}

type Props = {
  saleActive: boolean;
  saleStartSec: number;
  deadlineSec: number;
  nowSec: number;
  initialMinBuy: bigint;
  growthRateWad: bigint;
  basePriceWad: bigint;
  dailyIncrementWad: bigint;
  decimals: number;
};

export function TimeCurveLiveCharts({
  saleActive,
  saleStartSec,
  deadlineSec,
  nowSec,
  initialMinBuy,
  growthRateWad,
  basePriceWad,
  dailyIncrementWad,
  decimals,
}: Props) {
  /** Sale-relative time for math (matches on-chain elapsed, capped at sale end). */
  const saleDurationSec = Math.max(0, deadlineSec - saleStartSec);
  const chartNowSec = Math.min(Math.max(nowSec, saleStartSec), deadlineSec);

  const elapsedLive = Math.min(Math.max(0, chartNowSec - saleStartSec), saleDurationSec);

  const axisMaxElapsed = useMemo(() => elapsedChartAxisMaxSeconds(elapsedLive), [elapsedLive]);

  const livePrice = linearPriceWadFloat(basePriceWad, dailyIncrementWad, elapsedLive);
  const liveMinGross = minGrossSpendAtFloat(
    initialMinBuy,
    growthRateWad,
    basePriceWad,
    dailyIncrementWad,
    elapsedLive,
  );
  const liveMaxGross = maxGrossSpendAtFloat(
    initialMinBuy,
    growthRateWad,
    basePriceWad,
    dailyIncrementWad,
    elapsedLive,
  );

  const startPrice = linearPriceWadFloat(basePriceWad, dailyIncrementWad, 0);
  const startMinGross = minGrossSpendAtFloat(
    initialMinBuy,
    growthRateWad,
    basePriceWad,
    dailyIncrementWad,
    0,
  );
  const startMaxGross = maxGrossSpendAtFloat(
    initialMinBuy,
    growthRateWad,
    basePriceWad,
    dailyIncrementWad,
    0,
  );

  const chartData = useMemo((): Point[] => {
    const span = Math.max(1e-9, axisMaxElapsed);
    const out: Point[] = [];
    for (let i = 0; i < CHART_SAMPLES; i += 1) {
      const elapsedSinceLaunch = (span * i) / (CHART_SAMPLES - 1);
      const elapsedForCurve = Math.min(elapsedSinceLaunch, saleDurationSec);
      const p = linearPriceWadFloat(basePriceWad, dailyIncrementWad, elapsedForCurve);
      const mn = minGrossSpendAtFloat(
        initialMinBuy,
        growthRateWad,
        basePriceWad,
        dailyIncrementWad,
        elapsedForCurve,
      );
      const mx = maxGrossSpendAtFloat(
        initialMinBuy,
        growthRateWad,
        basePriceWad,
        dailyIncrementWad,
        elapsedForCurve,
      );
      out.push({
        elapsedSinceLaunch,
        priceHuman: toHuman(p, 18),
        minGrossHuman: toHuman(mn, decimals),
        maxGrossHuman: toHuman(mx, decimals),
      });
    }
    return out;
  }, [
    axisMaxElapsed,
    saleDurationSec,
    initialMinBuy,
    growthRateWad,
    basePriceWad,
    dailyIncrementWad,
    decimals,
  ]);

  const priceHumanLive = toHuman(livePrice, 18);
  const minHumanLive = toHuman(liveMinGross, decimals);
  const maxHumanLive = toHuman(liveMaxGross, decimals);
  const startPriceHuman = toHuman(startPrice, 18);
  const startMinHuman = toHuman(startMinGross, decimals);
  const startMaxHuman = toHuman(startMaxGross, decimals);

  if (!saleActive) {
    return null;
  }

  return (
    <div className="timecurve-live-charts" aria-label="Live price and spend curves">
      <div className="timecurve-live-charts__intro">
        <p>
          Curves use the same sale math as the contracts (linear price per charm, exponential envelope for min/max
          CHARM). The horizontal axis is <strong>time since launch</strong> (HH:MM:SS from 0). The window runs from
          0 to <strong>3×</strong> your current elapsed time so <strong>now</strong> sits at one-third of the span.
          After the deadline, the marker sits at the sale end.
        </p>
      </div>

      <section className="timecurve-live-charts__panel" aria-labelledby="tc-live-price-heading">
        <h3 id="tc-live-price-heading" className="timecurve-live-charts__title">
          CL8Y per 1 CHARM (linear)
        </h3>
        <div className="timecurve-live-charts__live-row mono" aria-live="off">
          <span>
            Live: <strong>{priceHumanLive.toFixed(4)}</strong> CL8Y / CHARM
          </span>
          <span className="timecurve-live-charts__muted">
            at sale start: {startPriceHuman.toFixed(4)} CL8Y / CHARM
          </span>
        </div>
        <div className="timecurve-live-charts__plot">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
              <XAxis
                dataKey="elapsedSinceLaunch"
                type="number"
                domain={[0, axisMaxElapsed]}
                tickFormatter={formatElapsedHms}
                stroke="var(--line)"
                label={{ value: "Since launch", position: "insideBottom", offset: -4, fill: "var(--text-muted)", fontSize: 11 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(3) : "—")}
                stroke="var(--line)"
                width={56}
              />
              <Tooltip
                formatter={(value) => [
                  `${Number.isFinite(Number(value)) ? Number(value).toFixed(6) : "—"} CL8Y/CHARM`,
                  "Price",
                ]}
                labelFormatter={(elapsed) => `+${formatElapsedHms(Number(elapsed))} since launch`}
              />
              <Legend />
              <ReferenceLine
                y={startPriceHuman}
                stroke="var(--arcade-green-700)"
                strokeDasharray="5 5"
                label={{ value: "Sale start", fill: "var(--text-muted)", fontSize: 11 }}
              />
              <Line
                type="monotone"
                dataKey="priceHuman"
                name="Price (CL8Y / CHARM)"
                stroke="var(--arcade-green-500)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceLine
                x={elapsedLive}
                stroke="var(--arcade-gold-600)"
                strokeWidth={1.5}
                strokeOpacity={0.85}
                label={{ value: "Now", fill: "var(--arcade-gold-600)", fontSize: 12 }}
              />
              <ReferenceDot
                x={elapsedLive}
                y={priceHumanLive}
                r={9}
                fill="var(--arcade-gold-400)"
                stroke="var(--line)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="timecurve-live-charts__panel" aria-labelledby="tc-live-bounds-heading">
        <h3 id="tc-live-bounds-heading" className="timecurve-live-charts__title">
          Min / max gross spend (CL8Y, exponential envelope × linear price)
        </h3>
        <div className="timecurve-live-charts__live-row mono" aria-live="off">
          <span>
            Live min: <strong>{minHumanLive.toFixed(4)}</strong> CL8Y · Live max:{" "}
            <strong>{maxHumanLive.toFixed(4)}</strong> CL8Y
          </span>
          <span className="timecurve-live-charts__muted">
            at sale start: min {startMinHuman.toFixed(4)} · max {startMaxHuman.toFixed(4)} CL8Y
          </span>
        </div>
        <div className="timecurve-live-charts__plot">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.35} />
              <XAxis
                dataKey="elapsedSinceLaunch"
                type="number"
                domain={[0, axisMaxElapsed]}
                tickFormatter={formatElapsedHms}
                stroke="var(--line)"
                label={{ value: "Since launch", position: "insideBottom", offset: -4, fill: "var(--text-muted)", fontSize: 11 }}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) => (Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "—")}
                stroke="var(--line)"
                width={56}
              />
              <Tooltip
                formatter={(value, name) => [
                  `${Number.isFinite(Number(value)) ? Number(value).toFixed(6) : "—"} CL8Y`,
                  String(name),
                ]}
                labelFormatter={(elapsed) => `+${formatElapsedHms(Number(elapsed))} since launch`}
              />
              <Legend />
              <ReferenceLine
                y={startMinHuman}
                stroke="var(--arcade-green-700)"
                strokeDasharray="4 4"
                label={{ value: "Min @ start", fill: "var(--text-muted)", fontSize: 10 }}
              />
              <ReferenceLine
                y={startMaxHuman}
                stroke="var(--arcade-green-800)"
                strokeDasharray="4 4"
                label={{ value: "Max @ start", fill: "var(--text-muted)", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="minGrossHuman"
                name="Min gross (CL8Y)"
                stroke="var(--arcade-green-500)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="maxGrossHuman"
                name="Max gross (CL8Y)"
                stroke="var(--arcade-gold-600)"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <ReferenceLine
                x={elapsedLive}
                stroke="var(--arcade-gold-600)"
                strokeWidth={1.5}
                strokeOpacity={0.85}
                label={{ value: "Now", fill: "var(--arcade-gold-600)", fontSize: 12 }}
              />
              <ReferenceDot
                x={elapsedLive}
                y={minHumanLive}
                r={8}
                fill="var(--arcade-green-500)"
                stroke="var(--line)"
                strokeWidth={2}
              />
              <ReferenceDot
                x={elapsedLive}
                y={maxHumanLive}
                r={8}
                fill="var(--arcade-gold-600)"
                stroke="var(--line)"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}

"""
Raise milestones and time-series (daily spend / cumulative raise) for TimeCurve sims.

Tracks first crossing time for USDm thresholds and per-calendar-day (sim time) aggregates
for the first 30 days of each run.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import statistics
from dataclasses import dataclass, field
from pathlib import Path

from timecurve_sim.model import TimeCurveParams, canonical_timecurve_params, clamp_spend, min_buy_at, next_sale_end
from timecurve_sim.monte_carlo import _poisson

# USDm float units (same as elsewhere in timecurve_sim)
RAISE_MILESTONES = (1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000, 1_000_000_000)

NUM_CHART_DAYS = 30


@dataclass
class TrackedSaleOutcome:
    duration_sec: float
    total_raised: float
    total_buys: int
    hit_max_wall: bool
    milestone_first_sec: dict[int, float | None]
    daily_spend: list[float]
    cum_end_day: list[float]
    cum_events: list[tuple[float, float]] = field(repr=False)


def _cum_at_or_before(events: list[tuple[float, float]], t_limit: float) -> float:
    cum = 0.0
    for t, c in events:
        if t <= t_limit + 1e-9:
            cum = c
        else:
            break
    return cum


def run_sale_tracked(
    p: TimeCurveParams,
    *,
    rng: random.Random,
    milestones: tuple[int, ...] = RAISE_MILESTONES,
    dt_sec: float = 60.0,
    arrival_rate: float = 0.12,
    population: int = 500,
    whale_frac: float = 0.05,
    small_frac: float = 0.75,
    budget_scale: float = 1.0,
    max_wall_sec: float = 86400.0 * 400.0,
    max_steps: int = 10_000_000,
    num_day_buckets: int = NUM_CHART_DAYS,
) -> TrackedSaleOutcome:
    budgets: list[float] = []
    tier: list[str] = []
    for i in range(population):
        u = rng.random()
        if u < whale_frac:
            budgets.append(rng.lognormvariate(math.log(5000), math.log(1.8)) * budget_scale)
            tier.append("whale")
        elif u < whale_frac + small_frac:
            budgets.append(rng.uniform(80, 600) * budget_scale)
            tier.append("small")
        else:
            budgets.append(rng.uniform(400, 2500) * budget_scale)
            tier.append("medium")

    now = 0.0
    end = p.initial_timer_sec
    total_buys = 0
    total_spend = 0.0
    steps = 0

    milestone_first: dict[int, float | None] = {m: None for m in milestones}
    daily_spend = [0.0] * num_day_buckets
    cum_events: list[tuple[float, float]] = []

    while now < end and now < max_wall_sec and steps < max_steps:
        n_arrivals = _poisson(rng, arrival_rate * dt_sec)
        for _ in range(n_arrivals):
            idx = rng.randrange(population)
            mb = min_buy_at(now, p)
            cap = mb * p.purchase_cap_mult
            b = budgets[idx]
            if b < mb:
                continue

            t = tier[idx]
            if t == "whale":
                desired = min(cap, b, 0.92 * cap)
            elif t == "medium":
                desired = min(cap, b, mb * (1.5 + 4.0 * rng.random()))
            else:
                desired = min(cap, b, mb * (1.0 + 0.5 * rng.random()))

            spend = clamp_spend(desired, now, p)
            if spend > b + 1e-9:
                spend = min(spend, b)
                spend = clamp_spend(spend, now, p)
            if spend < mb - 1e-9:
                continue

            budgets[idx] -= spend
            total_buys += 1
            total_spend += spend
            end = next_sale_end(now, end, p)

            day_i = int(now // 86400.0)
            if 0 <= day_i < num_day_buckets:
                daily_spend[day_i] += spend

            for m in milestones:
                if milestone_first[m] is None and total_spend >= m:
                    milestone_first[m] = now
            cum_events.append((now, total_spend))

        now += dt_sec
        steps += 1

    final_t = now
    final_total = total_spend
    hit_wall = final_t >= max_wall_sec

    cum_end_day: list[float] = []
    for d in range(num_day_buckets):
        t_end = (d + 1) * 86400.0
        if t_end >= final_t:
            cum_end_day.append(final_total)
        else:
            cum_end_day.append(_cum_at_or_before(cum_events, t_end))

    return TrackedSaleOutcome(
        duration_sec=final_t,
        total_raised=final_total,
        total_buys=total_buys,
        hit_max_wall=hit_wall,
        milestone_first_sec=milestone_first,
        daily_spend=daily_spend,
        cum_end_day=cum_end_day,
        cum_events=cum_events,
    )


def _quantile(sorted_x: list[float], q: float) -> float:
    if not sorted_x:
        return float("nan")
    pos = (len(sorted_x) - 1) * q
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_x[lo]
    return sorted_x[lo] + (sorted_x[hi] - sorted_x[lo]) * (pos - lo)


def aggregate_runs(
    runs: list[TrackedSaleOutcome],
    *,
    milestones: tuple[int, ...] = RAISE_MILESTONES,
) -> dict[str, object]:
    n = len(runs)
    durs_days = [r.duration_sec / 86400.0 for r in runs]

    milestone_summary: dict[str, object] = {}
    for m in milestones:
        times = [r.milestone_first_sec[m] for r in runs if r.milestone_first_sec[m] is not None]
        times_days = [t / 86400.0 for t in times] if times else []
        reached = len(times)
        milestone_summary[str(m)] = {
            "reached_count": reached,
            "reached_frac": reached / n if n else 0.0,
            "days_to_reach_mean": statistics.mean(times_days) if times else None,
            "days_to_reach_median": statistics.median(times_days) if times else None,
            "days_to_reach_p25": _quantile(sorted(times_days), 0.25) if len(times) >= 2 else (times_days[0] if times else None),
            "days_to_reach_p75": _quantile(sorted(times_days), 0.75) if len(times) >= 2 else (times_days[0] if times else None),
        }

    num_days = NUM_CHART_DAYS
    daily_min: list[float] = []
    daily_max: list[float] = []
    daily_mean: list[float] = []
    cum_min: list[float] = []
    cum_max: list[float] = []
    cum_mean: list[float] = []
    for d in range(num_days):
        if not runs:
            daily_min.append(0.0)
            daily_max.append(0.0)
            daily_mean.append(0.0)
            cum_min.append(0.0)
            cum_max.append(0.0)
            cum_mean.append(0.0)
            continue
        ds = [r.daily_spend[d] for r in runs]
        cs = [r.cum_end_day[d] for r in runs]
        daily_min.append(min(ds))
        daily_max.append(max(ds))
        daily_mean.append(statistics.mean(ds))
        cum_min.append(min(cs))
        cum_max.append(max(cs))
        cum_mean.append(statistics.mean(cs))

    return {
        "num_seeds": n,
        "sale_duration_days": {
            "mean": statistics.mean(durs_days) if durs_days else float("nan"),
            "median": statistics.median(durs_days) if durs_days else float("nan"),
            "min": min(durs_days) if durs_days else float("nan"),
            "max": max(durs_days) if durs_days else float("nan"),
            "p25": _quantile(sorted(durs_days), 0.25) if len(durs_days) >= 2 else durs_days[0] if durs_days else float("nan"),
            "p75": _quantile(sorted(durs_days), 0.75) if len(durs_days) >= 2 else durs_days[0] if durs_days else float("nan"),
            "p90": _quantile(sorted(durs_days), 0.90) if durs_days else float("nan"),
        },
        "milestones_days_to_reach": milestone_summary,
        "per_sim_day_index_1_based": {
            "daily_spend_min": daily_min,
            "daily_spend_max": daily_max,
            "daily_spend_mean": daily_mean,
            "cum_raise_min": cum_min,
            "cum_raise_max": cum_max,
            "cum_raise_mean": cum_mean,
        },
    }


def run_scenario(
    name: str,
    p: TimeCurveParams,
    *,
    seeds: int,
    base_seed: int,
    arrival_rate: float,
    budget_scale: float,
    max_wall_sec: float,
) -> dict[str, object]:
    runs: list[TrackedSaleOutcome] = []
    for s in range(seeds):
        rng = random.Random(base_seed + s * 1009 + hash((name, p)) % 997)
        runs.append(
            run_sale_tracked(
                p,
                rng=rng,
                arrival_rate=arrival_rate,
                budget_scale=budget_scale,
                max_wall_sec=max_wall_sec,
            )
        )
    agg = aggregate_runs(runs)
    return {
        "scenario": name,
        "arrival_rate": arrival_rate,
        "budget_scale": budget_scale,
        "max_wall_days": max_wall_sec / 86400.0,
        **agg,
        "sample_runs_for_charts": [
            {
                "seed_index": i,
                "daily_spend": runs[i].daily_spend,
                "cum_end_day": runs[i].cum_end_day,
                "duration_days": runs[i].duration_sec / 86400.0,
                "total_raised": runs[i].total_raised,
            }
            for i in range(min(10, len(runs)))
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description="Raise milestones + 30d spend/raise series")
    ap.add_argument("--seeds", type=int, default=80)
    ap.add_argument("--base-seed", type=int, default=42)
    ap.add_argument("--out-json", type=Path, default=None)
    ap.add_argument(
        "--out-chart",
        type=Path,
        default=None,
        help="Chart path (.png recommended if matplotlib installed; else .svg)",
    )
    ap.add_argument(
        "--chart-scenario",
        type=str,
        default="medium",
        help="Which scenario block to plot (must match scenario name, e.g. medium)",
    )
    args = ap.parse_args()

    p0 = canonical_timecurve_params()
    scenarios: list[tuple[str, TimeCurveParams, float, float, float]] = [
        ("medium", p0, 0.03, 1.0, 86400.0 * 60),
        ("heavy", p0, 0.12, 1.0, 86400.0 * 45),
        ("heavy_whale_budget", p0, 0.12, 50.0, 86400.0 * 45),
    ]

    report: dict[str, object] = {
        "seeds": args.seeds,
        "milestones_usdm": list(RAISE_MILESTONES),
        "chart_days": NUM_CHART_DAYS,
        "scenarios": [],
    }
    for name, par, arr, bscale, wall in scenarios:
        report["scenarios"].append(
            run_scenario(
                name,
                par,
                seeds=args.seeds,
                base_seed=args.base_seed,
                arrival_rate=arr,
                budget_scale=bscale,
                max_wall_sec=wall,
            )
        )

    text = json.dumps(report, indent=2)
    if args.out_json:
        args.out_json.parent.mkdir(parents=True, exist_ok=True)
        args.out_json.write_text(text, encoding="utf-8")
    print(text)

    if args.out_chart:
        from timecurve_sim.chart_raise_curves import (
            render_raise_curve_chart,
            render_raise_curve_chart_png_if_available,
        )

        args.out_chart.parent.mkdir(parents=True, exist_ok=True)
        if args.out_chart.suffix.lower() == ".png":
            render_raise_curve_chart_png_if_available(
                report, args.out_chart, scenario_name=args.chart_scenario
            )
        else:
            render_raise_curve_chart(report, args.out_chart, scenario_name=args.chart_scenario)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

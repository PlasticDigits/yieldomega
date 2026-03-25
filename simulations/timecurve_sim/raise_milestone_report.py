"""
Aggregate raise milestones (1k … 1b USDm) vs simulated time, and sale-end duration.

Uses the same agent model as `duration_study.run_sale_with_raise_milestones`.
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
from typing import Any

from timecurve_sim.duration_study import (
    RAISE_MILESTONES,
    TrackedOutcome,
    deploy_dev_params,
    run_sale_with_raise_milestones,
)
from timecurve_sim.duration_study import _quantile
from timecurve_sim.model import TimeCurveParams


def summarize_tracked(
    runs: list[TrackedOutcome],
    milestones: tuple[int, ...] = RAISE_MILESTONES,
) -> dict[str, Any]:
    n = len(runs)
    durs_days = [r.duration_sec / 86400.0 for r in runs]
    sale_end = {
        "mean_days": statistics.mean(durs_days) if durs_days else 0.0,
        "median_days": statistics.median(durs_days) if durs_days else 0.0,
        "p25_days": _quantile(durs_days, 0.25),
        "p75_days": _quantile(durs_days, 0.75),
        "p90_days": _quantile(durs_days, 0.90),
        "min_days": min(durs_days) if durs_days else 0.0,
        "max_days": max(durs_days) if durs_days else 0.0,
    }
    by_m: dict[str, Any] = {}
    for m in milestones:
        times_sec = [r.first_crossing_sec.get(m) for r in runs]
        reached = [t for t in times_sec if t is not None]
        reached_days = [t / 86400.0 for t in reached]
        by_m[str(m)] = {
            "reached_frac": len(reached) / n if n else 0.0,
            "n_reached": len(reached),
            "mean_days_to_reach": statistics.mean(reached_days) if reached else None,
            "median_days_to_reach": statistics.median(reached_days) if reached else None,
            "p25_days_to_reach": _quantile(reached_days, 0.25) if len(reached) >= 2 else (reached_days[0] if reached else None),
            "p75_days_to_reach": _quantile(reached_days, 0.75) if len(reached) >= 2 else (reached_days[0] if reached else None),
            "p90_days_to_reach": _quantile(reached_days, 0.90) if len(reached) >= 2 else (reached_days[0] if reached else None),
        }
    return {
        "n_seeds": n,
        "sale_end_days_distribution": sale_end,
        "final_raised_usd_median": statistics.median([r.total_raised for r in runs]) if runs else 0.0,
        "hit_max_wall_frac": sum(1 for r in runs if r.hit_max_wall) / n if n else 0.0,
        "milestones_days_to_reach": by_m,
    }


def run_report(
    *,
    seeds: int,
    base_seed: int,
    dt_sec: float = 120.0,
) -> dict[str, Any]:
    p0 = deploy_dev_params()
    # (name, params, arrival_rate, budget_scale, max_wall_days)
    scenarios: list[tuple[str, TimeCurveParams, float, float, float]] = [
        ("medium", p0, 0.03, 1.0, 120.0),
        ("heavy", p0, 0.12, 1.0, 90.0),
        ("heavy_whale_budget_50x", p0, 0.12, 50.0, 180.0),
        ("heavy_whale_budget_500x", p0, 0.12, 500.0, 800.0),
        # Large wallet scale + long wall so $1B tier can appear before timer-driven sale end.
        ("heavy_whale_budget_4000x", p0, 0.12, 4000.0, 2000.0),
    ]
    out: dict[str, Any] = {
        "canonical_params": "deploy_dev_params / TimeCurve aligned",
        "dt_sec": dt_sec,
        "scenarios": [],
    }
    for name, par, arr, bscale, wall_days in scenarios:
        runs = []
        for s in range(seeds):
            rng = random.Random(base_seed + s * 1009 + hash((name, par, bscale)) % 997)
            runs.append(
                run_sale_with_raise_milestones(
                    par,
                    rng=rng,
                    dt_sec=dt_sec,
                    arrival_rate=arr,
                    budget_scale=bscale,
                    max_wall_sec=wall_days * 86400.0,
                )
            )
        row = {"scenario": name, "arrival_rate": arr, "budget_scale": bscale, "max_wall_days": wall_days}
        row.update(summarize_tracked(runs))
        out["scenarios"].append(row)
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="Raise milestone timing + sale duration distribution")
    ap.add_argument("--seeds", type=int, default=80, help="Monte Carlo seeds per scenario")
    ap.add_argument("--base-seed", type=int, default=42)
    ap.add_argument("--dt-sec", type=float, default=120.0, help="Sim step size (larger = faster, coarser)")
    ap.add_argument("--out", type=str, default=None, help="Optional JSON path")
    args = ap.parse_args()
    payload = run_report(seeds=args.seeds, base_seed=args.base_seed, dt_sec=args.dt_sec)
    txt = json.dumps(payload, indent=2)
    print(txt)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(txt)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

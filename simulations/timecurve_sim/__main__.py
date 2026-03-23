"""CLI: sweep TimeCurve parameters and print retail-friendliness ranking."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from timecurve_sim.monte_carlo import default_sweep_grid, score_for_retail_friendly, sweep_configs


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="TimeCurve Monte Carlo — concentration vs parameters")
    p.add_argument("--seeds", type=int, default=50, help="Monte Carlo seeds per config")
    p.add_argument("--full-grid", action="store_true", help="Larger parameter grid (slower)")
    p.add_argument("--top", type=int, default=8, help="How many configs to print")
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Write JSON with top configs and metrics",
    )
    args = p.parse_args(argv)

    grid = default_sweep_grid(full=args.full_grid)
    ranked = sweep_configs(grid, seeds=args.seeds)
    scored: list[tuple[float, object, dict]] = []
    for param, acc in ranked:
        scored.append((score_for_retail_friendly(acc), param, acc))
    scored.sort(key=lambda x: -x[0])

    print(f"configs={len(grid)}  seeds={args.seeds}  full_grid={args.full_grid}")
    print("score  gini  top5%  whale%  uniq  buys  growth  mult  ext_s  cap_h")
    for i, (sc, par, acc) in enumerate(scored[: args.top]):
        cap_h = par.timer_cap_from_now_sec / 3600.0
        print(
            f"{sc:5.2f}  {acc['gini_spend']:.3f}  {acc['top5_share']:.3f}  "
            f"{acc['whale_spend_share']:.3f}  {acc['unique_buyers']:4.0f}  {acc['total_buys']:5.0f}  "
            f"{par.daily_growth_frac:.4f}  {par.purchase_cap_mult:g}  {par.extension_sec:g}  {cap_h:g}"
        )

    payload = {
        "seeds": args.seeds,
        "full_grid": args.full_grid,
        "top": [
            {
                "score": sc,
                "params": {
                    "daily_growth_frac": par.daily_growth_frac,
                    "min_buy_0": par.min_buy_0,
                    "purchase_cap_mult": par.purchase_cap_mult,
                    "extension_sec": par.extension_sec,
                    "timer_cap_from_now_hours": par.timer_cap_from_now_sec / 3600.0,
                    "initial_timer_sec": par.initial_timer_sec,
                },
                "metrics": acc,
            }
            for sc, par, acc in scored[: args.top]
        ],
    }
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

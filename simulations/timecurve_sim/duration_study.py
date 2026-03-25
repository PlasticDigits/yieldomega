"""
Wall-clock sale duration vs participation and raise — for parameter tuning.

The onchain TimeCurve ends when `block.timestamp >= deadline` and nobody buys for long
enough that the sliding deadline is not pushed forward. Sustained buying can defer
the end indefinitely unless a separate absolute cap exists (not in v1 contracts).

This module runs the same discrete-time agent model as `monte_carlo.run_single_sale`
but advances until the timer expires or `max_wall_sec` (sale still "live" = hit wall).
"""

from __future__ import annotations

import json
import math
import random
import statistics
from dataclasses import dataclass

from timecurve_sim.model import (
    TimeCurveParams,
    canonical_timecurve_params,
    clamp_spend,
    hybrid_exploration_params,
    min_buy_at,
    next_sale_end,
)
from timecurve_sim.monte_carlo import _poisson


# USDm raised — first crossing time (sim clock) for milestone reports
RAISE_MILESTONES: tuple[int, ...] = (
    1_000,
    10_000,
    100_000,
    1_000_000,
    10_000_000,
    100_000_000,
    1_000_000_000,
)


@dataclass(frozen=True)
class DurationOutcome:
    duration_sec: float
    total_raised: float
    total_buys: int
    completed_naturally: bool  # timer expired before max_wall
    hit_max_wall: bool


@dataclass(frozen=True)
class TrackedOutcome:
    """Like `DurationOutcome` plus first simulated time each raise tier was crossed."""

    duration_sec: float
    total_raised: float
    total_buys: int
    completed_naturally: bool
    hit_max_wall: bool
    first_crossing_sec: dict[int, float | None]  # milestone USD → first `now` with total_raised >= m


def _tier_compliance(outcomes: list[DurationOutcome]) -> dict[str, float | int]:
    """
    Soft targets (product intent, not enforced onchain in v1):
      - total raised small → end within ~48h
      - raised ≤ 100k → within ~5d
      - raised ≤ 1m → within ~10d
      - raised ≤ 1b → within ~30d

    Returns conditional hit rates: among runs with raised in band, fraction with duration ≤ cap.
    """
    bands: list[tuple[str, float, float]] = [
        ("raised_le_10k_duration_le_48h", 10_000.0, 48 * 3600.0),
        ("raised_le_100k_duration_le_5d", 100_000.0, 5 * 86400.0),
        ("raised_le_1m_duration_le_10d", 1_000_000.0, 10 * 86400.0),
        ("raised_le_1b_duration_le_30d", 1_000_000_000.0, 30 * 86400.0),
    ]
    out: dict[str, float | int] = {}
    for key, r_max, d_max in bands:
        tot = sum(1 for o in outcomes if o.total_raised <= r_max)
        ok = sum(1 for o in outcomes if o.total_raised <= r_max and o.duration_sec <= d_max)
        out[key + "_numerator"] = ok
        out[key + "_denominator"] = tot
        if tot:
            out[key + "_rate"] = ok / tot
    return out


def _run_sale_core(
    p: TimeCurveParams,
    *,
    rng: random.Random,
    dt_sec: float,
    arrival_rate: float,
    population: int,
    whale_frac: float,
    small_frac: float,
    budget_scale: float,
    max_wall_sec: float,
    max_steps: int,
    track_milestones: tuple[int, ...] | None,
) -> tuple[DurationOutcome, dict[int, float | None] | None]:
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

    milestone_first: dict[int, float | None] | None = None
    if track_milestones:
        milestone_first = {m: None for m in track_milestones}

    now = 0.0
    end = p.initial_timer_sec
    total_buys = 0
    total_spend = 0.0
    steps = 0

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

            if milestone_first is not None and track_milestones is not None:
                for m in track_milestones:
                    if milestone_first[m] is None and total_spend >= m:
                        milestone_first[m] = now

        now += dt_sec
        steps += 1

    completed = now >= end and now < max_wall_sec and steps < max_steps
    hit_wall = now >= max_wall_sec
    outcome = DurationOutcome(
        duration_sec=now,
        total_raised=total_spend,
        total_buys=total_buys,
        completed_naturally=completed,
        hit_max_wall=hit_wall,
    )
    return outcome, milestone_first


def run_sale_to_completion(
    p: TimeCurveParams,
    *,
    rng: random.Random,
    dt_sec: float = 60.0,
    arrival_rate: float = 0.12,
    population: int = 500,
    whale_frac: float = 0.05,
    small_frac: float = 0.75,
    budget_scale: float = 1.0,
    max_wall_sec: float = 86400.0 * 400.0,
    max_steps: int = 10_000_000,
) -> DurationOutcome:
    """
    Run until `now >= deadline` (natural completion) or `now >= max_wall_sec`.

    Budget tiers match `monte_carlo.run_single_sale`, scaled by `budget_scale`.
    """
    o, _ = _run_sale_core(
        p,
        rng=rng,
        dt_sec=dt_sec,
        arrival_rate=arrival_rate,
        population=population,
        whale_frac=whale_frac,
        small_frac=small_frac,
        budget_scale=budget_scale,
        max_wall_sec=max_wall_sec,
        max_steps=max_steps,
        track_milestones=None,
    )
    return o


def run_sale_with_raise_milestones(
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
) -> TrackedOutcome:
    """Same dynamics as `run_sale_to_completion` but records first crossing time per raise tier."""
    o, mf = _run_sale_core(
        p,
        rng=rng,
        dt_sec=dt_sec,
        arrival_rate=arrival_rate,
        population=population,
        whale_frac=whale_frac,
        small_frac=small_frac,
        budget_scale=budget_scale,
        max_wall_sec=max_wall_sec,
        max_steps=max_steps,
        track_milestones=milestones,
    )
    assert mf is not None
    return TrackedOutcome(
        duration_sec=o.duration_sec,
        total_raised=o.total_raised,
        total_buys=o.total_buys,
        completed_naturally=o.completed_naturally,
        hit_max_wall=o.hit_max_wall,
        first_crossing_sec=mf,
    )


def deploy_dev_params() -> TimeCurveParams:
    """Defaults aligned with `contracts/script/DeployDev.s.sol` (float units = USDm)."""
    return canonical_timecurve_params()


def sweep_duration_scenarios(
    seeds: int = 30,
    base_seed: int = 42,
) -> dict[str, object]:
    """
    Compare participation regimes against soft duration targets (informal, not strict).

    Targets (product intent):
      - sparse activity: end within ~48h
      - raise ~100k: end within ~5d
      - raise ~1m: end within ~10d
      - raise ~1b: end within ~30d

    Note: vanilla timer extension can keep a hot sale open past any wall-clock target
    if buys keep landing before the deadline — see `hit_max_wall` counts.
    """
    p0 = deploy_dev_params()
    rows: list[dict[str, object]] = []

    # arrival_rate is per simulated second (Poisson mean λ with λ·dt arrivals per step).
    # With dt=60s: λ=0.0003 → ~26 arrivals/day total (sparse); λ=0.003 → ~260/day (still "low").
    scenarios: list[tuple[str, TimeCurveParams, float, float, float]] = [
        ("idle_sparse", p0, 0.0003, 1.0, 86400.0 * 14),
        ("low_participation", p0, 0.003, 1.0, 86400.0 * 14),
        ("medium", p0, 0.03, 1.0, 86400.0 * 60),
        ("heavy", p0, 0.12, 1.0, 86400.0 * 45),
        ("heavy_whale_budget", p0, 0.12, 50.0, 86400.0 * 45),
    ]

    # Alternative: shorter initial window + tighter cap (still 120s extension per buy)
    p_tight = TimeCurveParams(
        daily_growth_frac=p0.daily_growth_frac,
        min_buy_0=p0.min_buy_0,
        purchase_cap_mult=p0.purchase_cap_mult,
        extension_sec=p0.extension_sec,
        timer_cap_from_now_sec=3 * 86400.0,
        initial_timer_sec=48 * 3600.0,
    )
    scenarios.append(("tight_timer_medium", p_tight, 0.03, 1.0, 86400.0 * 60))
    scenarios.append(("tight_timer_heavy", p_tight, 0.12, 1.0, 86400.0 * 45))

    # Sim-only hybrid min-buy (see `timecurve_sim.model.hybrid_exploration_params`)
    ph = hybrid_exploration_params()
    scenarios.append(("hybrid_minbuy_medium", ph, 0.03, 1.0, 86400.0 * 60))

    for name, par, arr, bscale, wall in scenarios:
        outcomes = [
            run_sale_to_completion(
                par,
                rng=random.Random(base_seed + s * 1009 + hash((name, par)) % 997),
                arrival_rate=arr,
                budget_scale=bscale,
                max_wall_sec=wall,
            )
            for s in range(seeds)
        ]
        durs = [o.duration_sec for o in outcomes]
        raises = [o.total_raised for o in outcomes]
        walls = sum(1 for o in outcomes if o.hit_max_wall)
        tier = _tier_compliance(outcomes)
        rows.append(
            {
                "scenario": name,
                "params": {
                    "daily_growth_frac": par.daily_growth_frac,
                    "min_buy_0": par.min_buy_0,
                    "purchase_cap_mult": par.purchase_cap_mult,
                    "extension_sec": par.extension_sec,
                    "timer_cap_h": par.timer_cap_from_now_sec / 3600.0,
                    "initial_timer_h": par.initial_timer_sec / 3600.0,
                },
                "arrival_rate": arr,
                "budget_scale": bscale,
                "max_wall_days": wall / 86400.0,
                "seeds": seeds,
                "duration_h_median": statistics.median(durs) / 3600.0,
                "duration_h_p90": _quantile(durs, 0.90) / 3600.0,
                "raised_median": statistics.median(raises),
                "raised_p90": _quantile(raises, 0.90),
                "hit_max_wall_frac": walls / seeds,
                "tier_compliance": {k: v for k, v in tier.items() if k.endswith("_rate") or k.endswith("_denominator")},
            }
        )

    return {"baseline": "deploy_dev_params", "scenarios": rows}


def _quantile(x: list[float], q: float) -> float:
    if not x:
        return 0.0
    s = sorted(x)
    pos = (len(s) - 1) * q
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return s[lo]
    return s[lo] + (s[hi] - s[lo]) * (pos - lo)


def alternative_min_buy_formulas(t_sec: float, min0: float) -> dict[str, float]:
    """
    Illustrative only — onchain `TimeMath` uses continuous exp with `growthRateWad`.

    For linear-early + steeper tail exploration, use `hybrid_exploration_params()` / `min_buy_at`
    (not deployed in v1 contracts).
    """
    days = t_sec / 86400.0
    exp_daily = min0 * math.exp(math.log(1.25) * days)
    linear = min0 * (1.0 + 0.25 * days)
    sqrt_curve = min0 * (1.0 + 0.25 * math.sqrt(max(0.0, days)))
    p_h = hybrid_exploration_params()
    hybrid = min0 * min_buy_at(t_sec, p_h) / p_h.min_buy_0
    return {
        "exp_25pct_per_day_onchain": exp_daily,
        "linear_25pct_per_day": linear,
        "sqrt_scaled_25pct": sqrt_curve,
        "hybrid_linear_plus_tail_sim": hybrid,
    }


def main() -> int:
    out = sweep_duration_scenarios(seeds=24)
    print(json.dumps(out, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

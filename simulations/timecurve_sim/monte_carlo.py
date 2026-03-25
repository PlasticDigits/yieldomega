"""Stochastic participation: many small players vs few whales — sweep metrics."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from timecurve_sim.model import (
    TimeCurveParams,
    canonical_timecurve_params,
    clamp_spend,
    min_buy_at,
    next_sale_end,
)


def gini_coefficient(values: list[float]) -> float:
    """Gini in [0,1]; 0 = equal, 1 = one holder."""
    if not values:
        return 0.0
    x = sorted(max(0.0, v) for v in values)
    n = len(x)
    s = sum(x)
    if s <= 0 or n == 0:
        return 0.0
    cum = sum((i + 1) * v for i, v in enumerate(x))
    return (2.0 * cum) / (n * s) - (n + 1.0) / n


def top_k_share(values: list[float], k_frac: float = 0.05) -> float:
    """Fraction of total held by top k_frac of players (by spend)."""
    if not values:
        return 0.0
    x = sorted(max(0.0, v) for v in values)
    s = sum(x)
    if s <= 0:
        return 0.0
    n = len(x)
    k = max(1, int(math.ceil(k_frac * n)))
    return sum(x[-k:]) / s


@dataclass
class SimMetrics:
    gini_spend: float
    top5_share: float
    unique_buyers: int
    total_buys: int
    total_spend: float
    whale_spend_share: float  # top decile by wallet size (ex ante) spend / total
    median_buys_per_player: float
    sale_duration_sec: float
    final_min_buy: float


def run_single_sale(
    p: TimeCurveParams,
    *,
    rng: random.Random,
    dt_sec: float = 10.0,
    arrival_rate: float = 0.12,
    horizon_sec: float = 28_800.0,  # 8h observation window (sale may still be live)
    max_steps: int = 50_000,
    population: int = 500,
    whale_frac: float = 0.05,
    small_frac: float = 0.75,
) -> SimMetrics:
    """
    Agents arrive Poisson-ish; each arrival picks a player id with replacement (crowd).

    - Small: tries spend in [min, 1.5 min] when possible (many small tickets).
    - Medium: up to ~40% of per-tx cap.
    - Whale: targets ~90% of per-tx cap (max pressure on concentration).

    Wallets have budgets; when exhausted, agent buys min only if they still want to participate.
    """
    # Ex ante wallet tiers (relative units; same as min_buy scale)
    budgets: list[float] = []
    tier: list[str] = []
    for i in range(population):
        u = rng.random()
        if u < whale_frac:
            budgets.append(rng.lognormvariate(math.log(5000), math.log(1.8)))
            tier.append("whale")
        elif u < whale_frac + small_frac:
            budgets.append(rng.uniform(80, 600))
            tier.append("small")
        else:
            budgets.append(rng.uniform(400, 2500))
            tier.append("medium")

    spend_by_player = [0.0] * population
    buys_by_player = [0] * population
    now = 0.0
    end = p.initial_timer_sec
    total_buys = 0
    total_spend = 0.0

    steps = 0
    # Bounded horizon: otherwise perpetual extensions make runtime unbounded.
    while now < end and now < horizon_sec and steps < max_steps:
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
                # small: prefer near-minimum buys
                desired = min(cap, b, mb * (1.0 + 0.5 * rng.random()))

            spend = clamp_spend(desired, now, p)
            if spend > b + 1e-9:
                spend = min(spend, b)
                spend = clamp_spend(spend, now, p)
            if spend < mb - 1e-9:
                continue

            budgets[idx] -= spend
            spend_by_player[idx] += spend
            buys_by_player[idx] += 1
            total_buys += 1
            total_spend += spend
            end = next_sale_end(now, end, p)

        now += dt_sec
        steps += 1

    non_zero = [s for s in spend_by_player if s > 0]
    uniq = len(non_zero)
    med_buys = 0.0
    if non_zero:
        active_buys = sorted(buys_by_player[i] for i, s in enumerate(spend_by_player) if s > 0)
        mid = len(active_buys) // 2
        med_buys = float(active_buys[mid])

    # Whale tier spend share (players who were labeled whale at start)
    whale_idx = [i for i, tr in enumerate(tier) if tr == "whale"]
    w_spend = sum(spend_by_player[i] for i in whale_idx)
    whale_share = w_spend / total_spend if total_spend > 0 else 0.0

    return SimMetrics(
        gini_spend=gini_coefficient(spend_by_player),
        top5_share=top_k_share(spend_by_player, 0.05),
        unique_buyers=uniq,
        total_buys=total_buys,
        total_spend=total_spend,
        whale_spend_share=whale_share,
        median_buys_per_player=med_buys,
        sale_duration_sec=now,
        final_min_buy=min_buy_at(now, p),
    )


def _poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    # Knuth for small lam
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= rng.random()
    return k - 1


def sweep_configs(
    configs: list[TimeCurveParams],
    *,
    seeds: int = 80,
    base_seed: int = 42,
) -> list[tuple[TimeCurveParams, dict[str, float]]]:
    """Run many seeds per config; return mean metrics."""
    out: list[tuple[TimeCurveParams, dict[str, float]]] = []
    keys = [
        "gini_spend",
        "top5_share",
        "unique_buyers",
        "total_buys",
        "whale_spend_share",
        "median_buys",
        "final_min_buy_ratio",
    ]
    for p in configs:
        acc = {k: 0.0 for k in keys}
        for s in range(seeds):
            rng = random.Random(base_seed + s * 1009 + hash(p) % 997)
            m = run_single_sale(p, rng=rng)
            acc["gini_spend"] += m.gini_spend
            acc["top5_share"] += m.top5_share
            acc["unique_buyers"] += m.unique_buyers
            acc["total_buys"] += m.total_buys
            acc["whale_spend_share"] += m.whale_spend_share
            acc["median_buys"] += m.median_buys_per_player
            acc["final_min_buy_ratio"] += m.final_min_buy / p.min_buy_0 if p.min_buy_0 > 0 else 0.0
        for k in acc:
            acc[k] /= seeds
        out.append((p, acc))
    return out


def default_sweep_grid(*, full: bool = False) -> list[TimeCurveParams]:
    """
    Parameter grid; timers match canonical deploy (24h initial, 96h cap, 120s extension).

    Sweeps purchase-cap multiple and daily growth; `full=True` adds more points per axis.
    """
    base = canonical_timecurve_params()
    rows: list[TimeCurveParams] = []
    mults = (5.0, 8.0, 12.0, 20.0) if full else (5.0, 8.0, 12.0)
    growths = (0.15, 0.20, 0.25, 0.30) if full else (0.20, 0.25, 0.30)
    for mult in mults:
        for g in growths:
            rows.append(
                TimeCurveParams(
                    daily_growth_frac=g,
                    min_buy_0=base.min_buy_0,
                    purchase_cap_mult=mult,
                    extension_sec=base.extension_sec,
                    timer_cap_from_now_sec=base.timer_cap_from_now_sec,
                    initial_timer_sec=base.initial_timer_sec,
                )
            )
    return rows


def score_for_retail_friendly(acc: dict[str, float]) -> float:
    """
    Higher is better for many small players: low Gini, low top-5% share, low whale share,
    many unique buyers and many total buys. Penalize extreme concentration.
    """
    return (
        (1.0 - acc["gini_spend"]) * 3.0
        + (1.0 - acc["top5_share"]) * 3.0
        + (1.0 - acc["whale_spend_share"]) * 2.0
        + math.log1p(acc["unique_buyers"]) * 0.35
        + math.log1p(acc["total_buys"]) * 0.12
    )

"""Discrete-time TimeCurve mechanics for simulations (aligned with docs/product/primitives.md)."""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass(frozen=True)
class TimeCurveParams:
    """Numeric policy bundle for sweep / Monte Carlo."""

    # Daily multiplicative growth (e.g. 0.25 = 25% per day); interpolated per-second onchain.
    daily_growth_frac: float
    # Starting minimum buy (USDm or wei-scaled float).
    min_buy_0: float
    # Max spend per tx = multiple × current min buy.
    purchase_cap_mult: float
    # Seconds added to sale end per qualifying buy (before cap).
    extension_sec: float
    # Sale end cannot be scheduled later than (now + this).
    timer_cap_from_now_sec: float
    # Initial countdown until sale end at t=0 (before first buy).
    initial_timer_sec: float
    # If set, use hybrid min-buy: linear leg for the first `hybrid_linear_days` calendar days
    # (slope = daily_growth_frac per day from start), then compound tail at `hybrid_tail_daily_frac`.
    # Sim-only unless mirrored in TimeMath.sol (v1 contracts use pure exponential).
    hybrid_linear_days: float | None = None
    hybrid_tail_daily_frac: float | None = None


def min_buy_at(t_sec: float, p: TimeCurveParams) -> float:
    """
    Minimum buy at elapsed `t_sec`.

    Default: continuous compounding min_buy_0 * (1 + daily_growth_frac) ** (t_sec / 86400)
    (matches `TimeMath.currentMinBuy` onchain).

    Hybrid: if `hybrid_linear_days` is set, `min = min_buy_0 * (1 + f * d)` for d <= D, then
    `m_knot * (1 + tail)^(d - D)` for d > D, where `f = daily_growth_frac`, `D = hybrid_linear_days`,
    `tail = hybrid_tail_daily_frac` (default ~max(f*1.5, 0.30)).
    """
    days = t_sec / 86400.0
    f = p.daily_growth_frac
    if p.hybrid_linear_days is None:
        return p.min_buy_0 * math.pow(1.0 + f, days)
    d_hi = p.hybrid_linear_days
    tail = p.hybrid_tail_daily_frac if p.hybrid_tail_daily_frac is not None else max(f * 1.5, 0.30)
    if days <= d_hi:
        return p.min_buy_0 * (1.0 + f * days)
    m_knot = p.min_buy_0 * (1.0 + f * d_hi)
    return m_knot * math.pow(1.0 + tail, days - d_hi)


def next_sale_end(now_sec: float, current_end_sec: float, p: TimeCurveParams) -> float:
    """
    One qualifying buy: extend deadline from current end, but not beyond now + timer_cap.

    Uses: new_end = min(now + cap, max(current_end, now) + extension).
    If current_end <= now, the sale is already over — caller must not apply this.
    """
    base = max(current_end_sec, now_sec)
    extended = base + p.extension_sec
    ceiling = now_sec + p.timer_cap_from_now_sec
    return min(extended, ceiling)


def clamp_spend(
    desired: float,
    t_sec: float,
    p: TimeCurveParams,
) -> float:
    """Clamp spend to [min_buy, cap_mult * min_buy] (continuous; no silent rounding in sim)."""
    lo = min_buy_at(t_sec, p)
    hi = lo * p.purchase_cap_mult
    return max(lo, min(hi, desired))


def canonical_timecurve_params(
    *,
    daily_growth_frac: float = 0.25,
    min_buy_0: float = 1.0,
    purchase_cap_mult: float = 10.0,
    extension_sec: float = 120.0,
    timer_cap_from_now_sec: float = 96 * 3600.0,
    initial_timer_sec: float = 24 * 3600.0,
    hybrid_linear_days: float | None = None,
    hybrid_tail_daily_frac: float | None = None,
) -> TimeCurveParams:
    """
    Canonical deployment targets (docs + `DeployDev.s.sol`): 24h initial, 96h timer cap,
    120s extension per buy, 25% daily min-buy growth (exponential onchain), 10× cap unless overridden.
    """
    return TimeCurveParams(
        daily_growth_frac=daily_growth_frac,
        min_buy_0=min_buy_0,
        purchase_cap_mult=purchase_cap_mult,
        extension_sec=extension_sec,
        timer_cap_from_now_sec=timer_cap_from_now_sec,
        initial_timer_sec=initial_timer_sec,
        hybrid_linear_days=hybrid_linear_days,
        hybrid_tail_daily_frac=hybrid_tail_daily_frac,
    )


def hybrid_exploration_params(
    *,
    linear_days: float = 5.0,
    tail_daily_frac: float = 0.38,
) -> TimeCurveParams:
    """Sim-only: linear early leg + stronger exponential tail (steeper long-run floor)."""
    return canonical_timecurve_params(
        hybrid_linear_days=linear_days,
        hybrid_tail_daily_frac=tail_daily_frac,
    )

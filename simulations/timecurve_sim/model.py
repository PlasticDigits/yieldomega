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


def min_buy_at(t_sec: float, p: TimeCurveParams) -> float:
    """Continuous compounding: min_buy_0 * (1 + daily_growth_frac) ** (t_sec / 86400)."""
    days = t_sec / 86400.0
    return p.min_buy_0 * math.pow(1.0 + p.daily_growth_frac, days)


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

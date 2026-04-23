# SPDX-License-Identifier: AGPL-3.0-or-later
"""Pure math for DOUB genesis / sale planning — aligns with onchain formulas where noted."""

from __future__ import annotations

WAD = 10**18
SECONDS_PER_DAY = 86_400

def linear_price_wad(elapsed_sec: int, base_wad: int, daily_increment_wad: int) -> int:
    """Match `LinearCharmPrice.priceWad` (integer division)."""
    if elapsed_sec < 0:
        raise ValueError("elapsed_sec must be non-negative")
    return base_wad + (daily_increment_wad * elapsed_sec) // SECONDS_PER_DAY


def implied_launch_price_usd_per_doub(*, fdv_usd: float, total_supply_tokens: float) -> float:
    """
    Fully diluted launch mark: P = FDV / total_supply (all genesis buckets priced at the same reference).
    """
    if total_supply_tokens <= 0:
        raise ValueError("total_supply_tokens must be positive")
    if fdv_usd < 0:
        raise ValueError("fdv_usd must be non-negative")
    return fdv_usd / total_supply_tokens


def sale_tranche_notional_usd(*, launch_price_usd_per_doub: float, sale_tokens: float) -> float:
    return launch_price_usd_per_doub * sale_tokens


def referral_charm_weight_denominator_multiplier(*, fraction_of_raise_from_referred_buys: float) -> float:
    """
    If a fraction `p` of buys (by count or by raise — caller's interpretation) uses a valid referral,
    and non-referred buys add `charmWad` to `totalCharmWeight` while referred buys add `1.1 * charmWad`,
    then totalCharmWeight / sum(charmWad) = (1-p)*1 + p*1.1 = 1 + 0.1*p.

    Canonical onchain rule: 5% + 5% of buyer `charmWad` as extra weight to referrer and buyer
    (`TimeCurve.REFERRAL_EACH_BPS`). This is sensitivity analysis only; the rule is not optional in code.
    """
    p = fraction_of_raise_from_referred_buys
    if not 0.0 <= p <= 1.0:
        raise ValueError("fraction must be in [0, 1]")
    return 1.0 + 0.1 * p


def k_doub_per_cl8y(*, sale_tokens: float, total_raise_cl8y: float) -> float:
    """Mintable sale model: constant k = DOUB (human units) per CL8Y (human units) gross routed."""
    if total_raise_cl8y <= 0:
        raise ValueError("total_raise_cl8y must be positive")
    if sale_tokens < 0:
        raise ValueError("sale_tokens must be non-negative")
    return sale_tokens / total_raise_cl8y


def clearing_cl8y_per_doub(*, total_raise_cl8y: float, sale_tokens: float) -> float:
    """Average CL8Y per DOUB if the full sale bucket cleared against `total_raise_cl8y` (planning metric)."""
    if sale_tokens <= 0:
        raise ValueError("sale_tokens must be positive")
    return total_raise_cl8y / sale_tokens


def doub_per_charm_from_k(*, k_doub_per_cl8y: float, price_cl8y_per_charm: float) -> float:
    """Planning: DOUB per 1 whole CHARM if mint rate is k DOUB per CL8Y and price is CL8Y per CHARM."""
    return k_doub_per_cl8y * price_cl8y_per_charm


def linear_raise_profile(
    *,
    duration_sec: float,
    total_raise_cl8y: float,
    steps: int,
) -> tuple[list[float], list[float]]:
    """
    Simple synthetic cumulative raise: linear from 0 to total_raise over duration_sec.
    Returns (time_sec[], cumulative_raise[]).
    """
    if steps < 2:
        raise ValueError("steps must be at least 2")
    if duration_sec <= 0:
        raise ValueError("duration_sec must be positive")
    times: list[float] = []
    raises: list[float] = []
    for i in range(steps):
        t = duration_sec * i / (steps - 1)
        times.append(t)
        raises.append(total_raise_cl8y * i / (steps - 1))
    return times, raises


def cumulative_mint_under_k(
    cumulative_raise_cl8y: float,
    *,
    k_doub_per_cl8y: float,
) -> float:
    """Mint schedule: DOUB minted so far = k * cumulative gross CL8Y (planning only)."""
    return k_doub_per_cl8y * cumulative_raise_cl8y


def price_path_samples(
    *,
    duration_sec: float,
    base_wad: int,
    daily_increment_wad: int,
    steps: int,
) -> tuple[list[float], list[float]]:
    """Elapsed seconds and `LinearCharmPrice`-style priceWad samples (float conversion for plotting)."""
    if steps < 2:
        raise ValueError("steps must be at least 2")
    times: list[float] = []
    prices: list[float] = []
    for i in range(steps):
        elapsed = int(duration_sec * i / (steps - 1))
        times.append(float(elapsed))
        prices.append(float(linear_price_wad(elapsed, base_wad, daily_increment_wad)))
    return times, prices

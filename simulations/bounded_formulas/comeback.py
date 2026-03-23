"""Mandatory faction comeback: baseline log score + bounded bonus for trailing factions."""

from __future__ import annotations

import math

from bounded_formulas.model import clip


def faction_scores(
    deposits: list[float],
    *,
    K: float = 1000.0,
    eta: float = 5000.0,
    B_comeback: float = 200.0,
    eps: float = 1e-12,
    use_median_trailing: bool = True,
) -> tuple[list[int], dict[str, float | list[float]]]:
    """
    Epoch faction scores with **mandatory** comeback (not optional).

    - Baseline: B_i = floor(K * ln(1 + D_i)).
    - Deposit share: r_i = D_i / (sum_j D_j + eps).
    - Reference share r_bar: leader's share r_max (plan-consistent "top" anchor).
    - Trailing: factions with r_i < median(r) when use_median_trailing, else r_i < r_max - delta.
    - Comeback bonus: clip(eta * (r_bar - r_i), 0, B_comeback) for trailing only.

    Returns integer scores for leaderboards and a dict of diagnostics.
    """
    n = len(deposits)
    if n == 0:
        return [], {"r": [], "baseline": [], "comeback": [], "raw_bonus": []}

    total = sum(deposits) + eps
    r = [d / total for d in deposits]
    r_max = max(r)
    sorted_r = sorted(r)
    median_r = sorted_r[n // 2]

    baseline = [int(math.floor(K * math.log(1.0 + max(d, 0.0)))) for d in deposits]

    raw_bonuses: list[float] = []
    bonuses: list[float] = []
    for i in range(n):
        is_trailing = r[i] < median_r if use_median_trailing else r[i] < r_max - 1e-6
        raw = eta * (r_max - r[i]) if is_trailing else 0.0
        raw_bonuses.append(raw)
        b = clip(raw, 0.0, B_comeback) if is_trailing else 0.0
        bonuses.append(b)

    scores = [baseline[i] + int(round(bonuses[i])) for i in range(n)]

    meta: dict[str, float | list[float]] = {
        "r": r,
        "r_max": r_max,
        "median_r": median_r,
        "baseline": [float(b) for b in baseline],
        "comeback": bonuses,
        "raw_bonus": raw_bonuses,
    }
    return scores, meta

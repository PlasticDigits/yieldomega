"""Core epoch math: clipped coverage, tanh multiplier, smoothed exchange-rate update."""

from __future__ import annotations

import math
from dataclasses import dataclass


def clip(x: float, lo: float, hi: float) -> float:
    return lo if x < lo else hi if x > hi else x


@dataclass(frozen=True)
class BurrowParams:
    """Tunable parameters (mirror intended onchain fixed-point ranges).

    On-chain `RabbitTreasury` enforces envelopes at initialize + PARAMS_ROLE setters;
    keep defaults consistent with `contracts/PARAMETERS.md` § Rabbit Treasury (GitLab #119).
    """

    # Clip coverage ratio R/(S*e) to [0, c_max]. Upper clip avoids blow-ups when S*e is tiny;
    # lower bound stays 0 so insolvency is visible (symmetric c_min would fake health at R=0).
    c_max: float = 2.0
    c_star: float = 1.05
    alpha: float = 0.02
    beta: float = 2.0
    m_min: float = 0.98
    m_max: float = 1.02
    lam: float = 0.5
    # Max absolute change in e per epoch as a fraction of current e
    delta_max_frac: float = 0.02
    eps: float = 1e-18


@dataclass
class BurrowState:
    """Reserve R (USDm), DOUB supply S, book exchange rate e (reserve per 1 DOUB)."""

    R: float
    S: float
    e: float

    def copy(self) -> BurrowState:
        return BurrowState(self.R, self.S, self.e)


def coverage(R: float, S: float, e: float, p: BurrowParams) -> float:
    """Coverage ratio C = R / (S * e), clipped to [0, c_max]."""
    denom = S * e + p.eps
    raw = R / denom
    return clip(raw, 0.0, p.c_max)


def multiplier(C: float, p: BurrowParams) -> float:
    """Bounded multiplier m in [m_min, m_max] using tanh around c_star."""
    inner = 1.0 + p.alpha * math.tanh(p.beta * (C - p.c_star))
    return clip(inner, p.m_min, p.m_max)


def update_e(e: float, m: float, p: BurrowParams) -> float:
    """e_target = e * m; step toward target with per-epoch cap on |Δe|."""
    e_target = e * m
    delta = p.lam * (e_target - e)
    max_delta = p.delta_max_frac * e
    delta_c = clip(delta, -max_delta, max_delta)
    return e + delta_c


def epoch_step(state: BurrowState, p: BurrowParams) -> tuple[BurrowState, dict[str, float]]:
    """
    One repricing epoch: read (R,S,e), compute C,m, update e only.
    Flows (deposits / withdrawals / fees) are applied by the caller by mutating state before calling.
    """
    C = coverage(state.R, state.S, state.e, p)
    m = multiplier(C, p)
    e_new = update_e(state.e, m, p)
    out = {"C": C, "m": m, "e": e_new}
    state.e = e_new
    return state, out


def assert_epoch_invariants(
    before: BurrowState,
    after: BurrowState,
    p: BurrowParams,
    metrics: dict[str, float],
) -> None:
    """Fail fast if NaN or bounds violated."""
    for name, v in [("R", after.R), ("S", after.S), ("e", after.e), ("C", metrics["C"]), ("m", metrics["m"])]:
        if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
            raise AssertionError(f"non-finite {name}={v}")
    if after.e <= 0:
        raise AssertionError(f"e must stay positive, got {after.e}")
    if metrics["m"] < p.m_min - 1e-12 or metrics["m"] > p.m_max + 1e-12:
        raise AssertionError(f"m out of bounds: {metrics['m']}")
    if metrics["C"] < -1e-12 or metrics["C"] > p.c_max + 1e-12:
        raise AssertionError(f"C out of bounds: {metrics['C']}")
    de = abs(after.e - before.e)
    if de > p.delta_max_frac * before.e + 1e-12:
        raise AssertionError(f"per-epoch |Δe| cap violated: de={de}, cap={p.delta_max_frac * before.e}")


def deposit(state: BurrowState, d: float) -> None:
    """Add d reserve; mint DOUB at current rate e (value minted = d)."""
    if d <= 0:
        return
    mint = d / state.e
    state.R += d
    state.S += mint


def withdraw(state: BurrowState, burn: float) -> None:
    """Burn DOUB; pay reserve at current e (capped by reserve)."""
    if burn <= 0 or state.e <= 0:
        return
    burn = min(burn, state.S)
    pay = burn * state.e
    if pay > state.R:
        burn = state.R / state.e
        pay = state.R
    state.S -= burn
    state.R -= pay
    if state.R < 0:
        state.R = 0.0


def add_fee(state: BurrowState, fee: float) -> None:
    """Fee income increases reserve without minting DOUB."""
    if fee > 0:
        state.R += fee

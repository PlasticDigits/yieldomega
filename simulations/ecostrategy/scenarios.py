"""EcoStrategy audit scenarios A–C (GitLab #161).

**A** — Early believers vs late sharks (believers never steal; sharks activate late).

**B** — Referral + presale stacked CHARM weight on a controlled cluster (audit M-01).

**C** — Predator swarm vs an early BP leader (full WarBow PvP hooks: steal / guard / revenge).
"""

from __future__ import annotations

import math
import random
from dataclasses import asdict, dataclass
from typing import Callable

from timecurve_sim.model import (
    TimeCurveParams,
    canonical_timecurve_params,
    clamp_spend,
    extend_deadline_or_reset_below_threshold,
    min_buy_at,
    process_defended_streak_sim,
    warbow_buy_bp_delta,
)

from ecostrategy.warbow_pvp import WarBowWorld


def _poisson(rng: random.Random, lam: float) -> int:
    if lam <= 0:
        return 0
    L = math.exp(-lam)
    k = 0
    p = 1.0
    while p > L:
        k += 1
        p *= rng.random()
    return k - 1


def _gini(values: list[float]) -> float:
    if not values:
        return 0.0
    x = sorted(max(0.0, v) for v in values)
    n = len(x)
    s = sum(x)
    if s <= 0:
        return 0.0
    cum = sum((i + 1) * v for i, v in enumerate(x))
    return (2.0 * cum) / (n * s) - (n + 1.0) / n


AfterTick = Callable[[float, WarBowWorld, random.Random], None]


@dataclass
class EcoScenarioResult:
    scenario: str
    seed: int
    population: int
    horizon_sec: float
    metrics: dict[str, float | int]

    def to_json_dict(self) -> dict:
        return asdict(self)


def _simulate_sale(
    p: TimeCurveParams,
    rng: random.Random,
    *,
    population: int,
    dt_sec: float,
    arrival_rate: float,
    horizon_sec: float,
    max_steps: int,
    whale_frac: float,
    small_frac: float,
    world: WarBowWorld,
    charm_weight_mult: Callable[[int], float],
    after_tick: AfterTick | None,
) -> dict[str, float | int]:
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
    charm_weight = [0.0] * population
    buys_by_player = [0] * population
    active_streak = [0] * population
    best_streak = [0] * population
    ds_last: int | None = None
    now = 0.0
    end = p.initial_timer_sec
    total_buys = 0
    total_spend = 0.0
    hard_reset_buys = 0
    steps = 0

    assert world.n == population
    bp = world.bp

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
                desired = min(cap, b, mb * (1.0 + 0.5 * rng.random()))

            spend = clamp_spend(desired, now, p)
            if spend > b + 1e-9:
                spend = min(spend, b)
                spend = clamp_spend(spend, now, p)
            if spend < mb - 1e-9:
                continue

            deadline_before = end
            remaining_before = deadline_before - now
            new_end, did_hard = extend_deadline_or_reset_below_threshold(now, deadline_before, p)
            actual_added = new_end - deadline_before

            sb, amb, rest = warbow_buy_bp_delta(
                remaining_before,
                did_hard,
                ds_last_idx=ds_last,
                active_streak=active_streak,
                buyer_idx=idx,
            )
            bp[idx] += sb + amb + rest
            if did_hard:
                hard_reset_buys += 1

            ds_last = process_defended_streak_sim(
                idx,
                remaining_before,
                actual_added,
                ds_last,
                active_streak,
                best_streak,
            )

            mult = charm_weight_mult(idx)
            charm_weight[idx] += spend * mult
            budgets[idx] -= spend
            spend_by_player[idx] += spend
            buys_by_player[idx] += 1
            total_buys += 1
            total_spend += spend
            end = new_end

        if after_tick is not None:
            after_tick(now, world, rng)

        now += dt_sec
        steps += 1

    non_zero_spend = [s for s in spend_by_player if s > 0]
    uniq = len(non_zero_spend)

    total_bp = float(sum(bp))
    leader = max(range(population), key=lambda i: bp[i])

    out: dict[str, float | int] = {
        "gini_spend": _gini(spend_by_player),
        "gini_charm_weight": _gini(charm_weight),
        "gini_bp": _gini([float(x) for x in bp]),
        "unique_buyers": uniq,
        "total_buys": total_buys,
        "total_spend": total_spend,
        "sale_horizon_sec_used": now,
        "final_min_buy": min_buy_at(now, p),
        "hard_reset_buys": hard_reset_buys,
        "total_battle_points": int(total_bp),
        "bp_leader_idx": leader,
        "bp_leader_points": bp[leader],
        "warbow_steals": world.steals_succeeded,
        "warbow_revenges": world.revenges_succeeded,
        "warbow_guards": world.guards_activated,
        "sum_charm_weight": sum(charm_weight),
    }
    return out


def run_scenario_a(
    *,
    seed: int = 42,
    population: int = 240,
    horizon_sec: float = 28_800.0,
    shark_phase_frac: float = 0.45,
    steal_attempt_prob: float = 0.08,
) -> EcoScenarioResult:
    """Early believers (no WarBow steals); late-phase sharks steal against high-BP holders."""
    rng = random.Random(seed)
    p = canonical_timecurve_params()
    world = WarBowWorld(population)

    believer_cut = int(population * 0.72)
    believers = set(range(believer_cut))
    sharks = set(range(int(population * 0.82), population))
    shark_phase_start = shark_phase_frac * horizon_sec

    def after_tick(now_sec: float, w: WarBowWorld, r: random.Random) -> None:
        if now_sec < shark_phase_start:
            return
        if r.random() > steal_attempt_prob:
            return
        pool = [i for i in sharks if w.bp[i] > 0]
        if not pool:
            return
        att = pool[r.randrange(len(pool))]
        candidates = [i for i in believers if w.bp[i] > 0 and i != att]
        if not candidates:
            candidates = [i for i in range(population) if w.bp[i] > 0 and i != att and i not in sharks]
        if not candidates:
            return
        vic = max(candidates, key=lambda i: w.bp[i])
        w.try_steal(att, vic, now_sec, pay_bypass_if_needed=True)

    metrics = _simulate_sale(
        p,
        rng,
        population=population,
        dt_sec=10.0,
        arrival_rate=0.11,
        horizon_sec=horizon_sec,
        max_steps=60_000,
        whale_frac=0.05,
        small_frac=0.72,
        world=world,
        charm_weight_mult=lambda _i: 1.0,
        after_tick=after_tick,
    )
    return EcoScenarioResult(
        scenario="A",
        seed=seed,
        population=population,
        horizon_sec=horizon_sec,
        metrics=metrics,
    )


def run_scenario_b(
    *,
    seed: int = 42,
    population: int = 240,
    horizon_sec: float = 28_800.0,
    cluster_frac: float = 0.28,
) -> EcoScenarioResult:
    """Controlled referral + presale beneficiary cluster: +125% CHARM weight vs paid spend (audit M-01 stack)."""
    rng = random.Random(seed)
    p = canonical_timecurve_params()
    world = WarBowWorld(population)
    k = max(1, int(population * cluster_frac))
    cluster = set(range(k))

    def charm_weight_mult(idx: int) -> float:
        # 100% paid + 15% presale + 5% referee + 5% referrer = 125% on coordinated buys.
        return 1.25 if idx in cluster else 1.0

    metrics = _simulate_sale(
        p,
        rng,
        population=population,
        dt_sec=10.0,
        arrival_rate=0.11,
        horizon_sec=horizon_sec,
        max_steps=60_000,
        whale_frac=0.05,
        small_frac=0.72,
        world=world,
        charm_weight_mult=charm_weight_mult,
        after_tick=None,
    )
    return EcoScenarioResult(
        scenario="B",
        seed=seed,
        population=population,
        horizon_sec=horizon_sec,
        metrics=metrics,
    )


def run_scenario_c(
    *,
    seed: int = 42,
    population: int = 240,
    horizon_sec: float = 28_800.0,
    pvp_start_frac: float = 0.38,
    steal_prob: float = 0.22,
    revenge_prob: float = 0.35,
    guard_once: bool = True,
) -> EcoScenarioResult:
    """Predators (low indices) hunt the current BP leader after `pvp_start_frac`; leader may guard once."""
    rng = random.Random(seed)
    p = canonical_timecurve_params()
    world = WarBowWorld(population)
    n_pred = min(6, max(2, population // 40))
    predators = list(range(n_pred))
    pvp_start = pvp_start_frac * horizon_sec
    leader_guarded = False

    def after_tick(now_sec: float, w: WarBowWorld, r: random.Random) -> None:
        nonlocal leader_guarded
        if now_sec < pvp_start:
            return

        leader = max(range(population), key=lambda i: w.bp[i])
        if w.bp[leader] <= 0:
            return

        if guard_once and not leader_guarded:
            w.try_guard(leader, now_sec)
            leader_guarded = True

        for att in predators:
            if w.bp[att] <= 0:
                continue
            if r.random() > steal_prob:
                continue
            if not w.can_steal(att, leader, now_sec):
                continue
            ok = w.try_steal(att, leader, now_sec, pay_bypass_if_needed=True)
            if ok and r.random() < revenge_prob:
                w.try_revenge(leader, att, now_sec)

    metrics = _simulate_sale(
        p,
        rng,
        population=population,
        dt_sec=10.0,
        arrival_rate=0.11,
        horizon_sec=horizon_sec,
        max_steps=60_000,
        whale_frac=0.05,
        small_frac=0.72,
        world=world,
        charm_weight_mult=lambda _i: 1.0,
        after_tick=after_tick,
    )
    return EcoScenarioResult(
        scenario="C",
        seed=seed,
        population=population,
        horizon_sec=horizon_sec,
        metrics=metrics,
    )


SCENARIO_RUNNERS = {
    "A": run_scenario_a,
    "B": run_scenario_b,
    "C": run_scenario_c,
}

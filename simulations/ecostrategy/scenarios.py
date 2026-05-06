"""EcoStrategy audit scenarios A–E (GitLab #161).

**A** — Early believers vs late sharks (believers never steal; sharks activate late).

**B** — Referral + presale stacked CHARM weight on a controlled cluster (audit M-01).

**C** — Predator swarm vs an early BP leader (full WarBow PvP hooks: steal / guard / revenge).

**D** — Final-window ordering: WarBow tick before vs after buys (same seed); optional WarBow flag plant tally.

**E** — FeeRouter fifth-sink Rabbit slice vs `receiveFee` booking + launch-anchor CL8Y (audit H-01 narrative).
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

from bounded_formulas.model import BurrowParams, BurrowState, epoch_step

from ecostrategy.constants import (
    DEFAULT_PROTOCOL_REVENUE_BURN_SHARE_WAD,
    FEE_SINK_WEIGHTS_BPS_DEFAULT,
    LAUNCH_LIQUIDITY_ANCHOR_DEN,
    LAUNCH_LIQUIDITY_ANCHOR_NUM,
)
from ecostrategy.fee_routing import fee_router_five_shares
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
    final_window_sec: float = 0.0,
    final_window_pvp_first: bool = False,
    final_window_plant_flag_prob: float = 0.0,
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
    flags_planted = 0

    assert world.n == population
    bp = world.bp

    while now < end and now < horizon_sec and steps < max_steps:
        in_final = final_window_sec > 0.0 and now >= horizon_sec - final_window_sec
        pvp_first_tick = in_final and final_window_pvp_first
        if after_tick is not None and pvp_first_tick:
            after_tick(now, world, rng)

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

            if in_final and final_window_plant_flag_prob > 0.0 and rng.random() < final_window_plant_flag_prob:
                flags_planted += 1

        if after_tick is not None and not pvp_first_tick:
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
        "warbow_flags_planted": flags_planted,
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


def _scenario_c_style_after_tick(
    *,
    population: int,
    predators: list[int],
    pvp_start: float,
    steal_prob: float,
    revenge_prob: float,
    guard_once: bool,
) -> AfterTick:
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

    return after_tick


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

    after_tick = _scenario_c_style_after_tick(
        population=population,
        predators=predators,
        pvp_start=pvp_start,
        steal_prob=steal_prob,
        revenge_prob=revenge_prob,
        guard_once=guard_once,
    )

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


def run_scenario_d(
    *,
    seed: int = 42,
    population: int = 240,
    horizon_sec: float = 28_800.0,
    final_window_sec: float | None = None,
    pvp_start_frac: float = 0.38,
    steal_prob: float = 0.22,
    revenge_prob: float = 0.35,
    guard_once: bool = True,
    plant_flag_prob: float = 0.35,
) -> EcoScenarioResult:
    """Same predator swarm as **C**, but the final observation window swaps WarBow tick vs buys ordering.

    Runs two full simulations with the same RNG seed: **`pvp_first`** executes **`after_tick`** before intra-tick buys
    inside the window; **`buy_first`** keeps the default buys-then-WarBow order. Tallies **`warbow_flags_planted`**
    on simulated buys (audit ordering narrative — not onchain `plantWarBowFlag` gas ordering).

    Each run must use its own **`after_tick`** closure from **`_scenario_c_style_after_tick`**: the factory holds
    mutable **`leader_guarded`** state; sharing one closure across runs would let the first run exhaust **`guard_once`**
    and bias ordering metrics ([GitLab #169](https://gitlab.com/PlasticDigits/yieldomega/-/issues/169)).
    """
    rng_buy = random.Random(seed)
    rng_pvp = random.Random(seed)
    p = canonical_timecurve_params()
    n_pred = min(6, max(2, population // 40))
    predators = list(range(n_pred))
    pvp_start = pvp_start_frac * horizon_sec
    fw = (
        final_window_sec
        if final_window_sec is not None
        else min(3600.0, max(120.0, 0.22 * horizon_sec))
    )

    after_tick_buy = _scenario_c_style_after_tick(
        population=population,
        predators=predators,
        pvp_start=pvp_start,
        steal_prob=steal_prob,
        revenge_prob=revenge_prob,
        guard_once=guard_once,
    )
    after_tick_pvp = _scenario_c_style_after_tick(
        population=population,
        predators=predators,
        pvp_start=pvp_start,
        steal_prob=steal_prob,
        revenge_prob=revenge_prob,
        guard_once=guard_once,
    )

    world_buy = WarBowWorld(population)
    m_buy = _simulate_sale(
        p,
        rng_buy,
        population=population,
        dt_sec=10.0,
        arrival_rate=0.11,
        horizon_sec=horizon_sec,
        max_steps=60_000,
        whale_frac=0.05,
        small_frac=0.72,
        world=world_buy,
        charm_weight_mult=lambda _i: 1.0,
        after_tick=after_tick_buy,
        final_window_sec=fw,
        final_window_pvp_first=False,
        final_window_plant_flag_prob=plant_flag_prob,
    )
    world_pvp = WarBowWorld(population)
    m_pvp = _simulate_sale(
        p,
        rng_pvp,
        population=population,
        dt_sec=10.0,
        arrival_rate=0.11,
        horizon_sec=horizon_sec,
        max_steps=60_000,
        whale_frac=0.05,
        small_frac=0.72,
        world=world_pvp,
        charm_weight_mult=lambda _i: 1.0,
        after_tick=after_tick_pvp,
        final_window_sec=fw,
        final_window_pvp_first=True,
        final_window_plant_flag_prob=plant_flag_prob,
    )

    metrics: dict[str, float | int] = {}
    for k, v in m_buy.items():
        metrics[f"buy_first_{k}"] = v
    for k, v in m_pvp.items():
        metrics[f"pvp_first_{k}"] = v

    metrics["final_window_sec"] = fw
    metrics["ordering_bp_leader_idx_match"] = int(m_buy["bp_leader_idx"] == m_pvp["bp_leader_idx"])
    metrics["ordering_steals_abs_delta"] = abs(int(m_buy["warbow_steals"]) - int(m_pvp["warbow_steals"]))
    metrics["ordering_revenges_abs_delta"] = abs(int(m_buy["warbow_revenges"]) - int(m_pvp["warbow_revenges"]))
    metrics["ordering_flags_planted_abs_delta"] = abs(
        int(m_buy["warbow_flags_planted"]) - int(m_pvp["warbow_flags_planted"])
    )

    return EcoScenarioResult(
        scenario="D",
        seed=seed,
        population=population,
        horizon_sec=horizon_sec,
        metrics=metrics,
    )


def run_scenario_e(
    *,
    seed: int = 42,
    population: int = 1,
    horizon_sec: float = 0.0,
    gross_cl8y_lo: float = 2_000.0,
    gross_cl8y_hi: float = 80_000.0,
    burrow_R0: float = 2_000_000.0,
    burrow_S0: float = 1_800_000.0,
    burrow_e0: float = 1.05,
) -> EcoScenarioResult:
    """FeeRouter fifth-sink Rabbit slice vs `receiveFee` booking (audit H-01) + launch-anchor CL8Y projection (#158).

    Uses canonical five-sink weights from **`PARAMETERS.md`**; **`receiveFee`** splits gross Rabbit slice into burn vs
    protocol-owned backing using **`DEFAULT_PROTOCOL_REVENUE_BURN_SHARE_WAD`** (illustrative — match deployed WAD at ops).
    Burrow **`coverage`** is compared after one repricing epoch with vs without booking the protocol share into **`R`**.
    """
    rng = random.Random(seed)
    gross = rng.uniform(gross_cl8y_lo, gross_cl8y_hi)
    charm_unit = 1.0
    price_per_charm = gross / max(charm_unit, 1e-18)

    shares = fee_router_five_shares(gross, FEE_SINK_WEIGHTS_BPS_DEFAULT)
    rabbit_slice = shares[4]
    burn_share = DEFAULT_PROTOCOL_REVENUE_BURN_SHARE_WAD / 1e18
    to_protocol = rabbit_slice * (1.0 - burn_share)
    burned = rabbit_slice * burn_share

    launch_anchor_cl8y = price_per_charm * charm_unit * LAUNCH_LIQUIDITY_ANCHOR_NUM / LAUNCH_LIQUIDITY_ANCHOR_DEN

    p_b = BurrowParams()
    st_rf = BurrowState(R=burrow_R0, S=burrow_S0, e=burrow_e0)
    st_rf.R += to_protocol
    _, met_rf = epoch_step(st_rf, p_b)

    st_direct = BurrowState(R=burrow_R0, S=burrow_S0, e=burrow_e0)
    _, met_direct = epoch_step(st_direct, p_b)

    metrics: dict[str, float | int] = {
        "gross_routed_cl8y": gross,
        "fee_sink_shares_cl8y": list(shares),
        "rabbit_sink_cl8y": rabbit_slice,
        "rabbit_protocol_booked_cl8y_via_receive_fee": to_protocol,
        "rabbit_burned_cl8y_via_receive_fee": burned,
        "h01_unbooked_protocol_equivalent_cl8y_if_direct_sink_only": to_protocol,
        "launch_anchor_cl8y_per_charm_at_clearing": launch_anchor_cl8y,
        "burrow_coverage_after_epoch_if_receive_fee": float(met_rf["C"]),
        "burrow_coverage_after_epoch_if_direct_sink_unbooked": float(met_direct["C"]),
        "burrow_coverage_delta_receive_minus_direct": float(met_rf["C"] - met_direct["C"]),
        "illustrative_protocol_revenue_burn_share_wad": DEFAULT_PROTOCOL_REVENUE_BURN_SHARE_WAD,
    }
    return EcoScenarioResult(
        scenario="E",
        seed=seed,
        population=population,
        horizon_sec=horizon_sec,
        metrics=metrics,
    )


SCENARIO_RUNNERS = {
    "A": run_scenario_a,
    "B": run_scenario_b,
    "C": run_scenario_c,
    "D": run_scenario_d,
    "E": run_scenario_e,
}

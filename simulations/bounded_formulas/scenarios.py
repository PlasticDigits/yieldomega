"""Scenario drivers: good / bad / worst / attack stress paths."""

from __future__ import annotations

import csv
import math
from dataclasses import dataclass
from pathlib import Path

from bounded_formulas.model import (
    BurrowParams,
    BurrowState,
    assert_epoch_invariants,
    deposit,
    epoch_step,
    add_fee,
    withdraw,
)


@dataclass
class ScenarioResult:
    name: str
    epochs: int
    final: BurrowState
    rows: list[dict[str, float]]
    passed: bool
    error: str | None


def _run_epochs(
    name: str,
    state: BurrowState,
    p: BurrowParams,
    epoch_hook,
    max_epochs: int,
) -> ScenarioResult:
    rows: list[dict[str, float]] = []
    err: str | None = None
    passed = True
    for t in range(max_epochs):
        before = state.copy()
        try:
            epoch_hook(t, state, p)
            state, metrics = epoch_step(state, p)
            assert_epoch_invariants(before, state, p, metrics)
            rows.append(
                {
                    "t": float(t),
                    "R": state.R,
                    "S": state.S,
                    "e": state.e,
                    "C": metrics["C"],
                    "m": metrics["m"],
                }
            )
        except Exception as ex:  # noqa: BLE001 — surface sim failures
            passed = False
            err = str(ex)
            break
    return ScenarioResult(name=name, epochs=len(rows), final=state, rows=rows, passed=passed, error=err)


def scenario_good(initial: BurrowState, p: BurrowParams, epochs: int = 120) -> ScenarioResult:
    """Steady deposits, small fees, low churn."""

    def hook(t: int, s: BurrowState, _p: BurrowParams) -> None:
        add_fee(s, 2.0)
        deposit(s, 100.0 + 0.5 * math.sin(t / 10.0))

    return _run_epochs("good", initial, p, hook, epochs)


def scenario_bad(initial: BurrowState, p: BurrowParams, epochs: int = 200) -> ScenarioResult:
    """Weak inflow: tiny deposits, occasional small withdrawals."""

    def hook(t: int, s: BurrowState, _p: BurrowParams) -> None:
        add_fee(s, 0.5)
        if t % 3 == 0:
            deposit(s, 10.0)
        if t % 17 == 0:
            withdraw(s, min(5.0, s.S * 0.01))

    return _run_epochs("bad", initial, p, hook, epochs)


def scenario_worst(initial: BurrowState, p: BurrowParams, epochs: int = 150) -> ScenarioResult:
    """Bank-run style: repeated large withdrawals, minimal fees."""

    def hook(t: int, s: BurrowState, _p: BurrowParams) -> None:
        add_fee(s, 0.1)
        if s.S > 1e-9:
            withdraw(s, s.S * 0.12)

    return _run_epochs("worst", initial, p, hook, epochs)


def scenario_attack(initial: BurrowState, p: BurrowParams, epochs: int = 180) -> ScenarioResult:
    """Oscillating whale deposits/withdraws to stress caps and coverage clipping."""

    def hook(t: int, s: BurrowState, _p: BurrowParams) -> None:
        add_fee(s, 1.0)
        phase = t % 8
        if phase < 4:
            deposit(s, 5000.0 + 100.0 * phase)
        else:
            if s.S > 1e-9:
                withdraw(s, s.S * 0.35)

    return _run_epochs("attack", initial, p, hook, epochs)


def write_csv(result: ScenarioResult, out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{result.name}.csv"
    if not result.rows:
        path.write_text("t,R,S,e,C,m\n", encoding="utf-8")
        return path
    fieldnames = list(result.rows[0].keys())
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(result.rows)
    return path


def run_all_scenarios(
    initial: BurrowState | None = None,
    p: BurrowParams | None = None,
    out_dir: Path | None = None,
) -> list[ScenarioResult]:
    """Run the four scenario classes; optional CSV under out_dir."""
    if initial is None:
        initial = BurrowState(R=1_000_000.0, S=1_000_000.0, e=1.0)
    if p is None:
        p = BurrowParams()

    results = [
        scenario_good(initial.copy(), p),
        scenario_bad(initial.copy(), p),
        scenario_worst(initial.copy(), p),
        scenario_attack(initial.copy(), p),
    ]
    if out_dir is not None:
        for r in results:
            write_csv(r, out_dir)
    return results

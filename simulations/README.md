# Yieldomega simulations

Python simulations for **Rabbit Treasury** bounded repricing (DOUB / **Burrow**), **mandatory faction comeback** scoring, and **TimeCurve** participation concentration (Monte Carlo). Contract implementation should match Burrow equations and invariants; TimeCurve sims inform parameter tuning, not consensus.

## Run

From this directory (`simulations/`):

```bash
PYTHONPATH=. python3 -m unittest discover -s tests -v
PYTHONPATH=. python3 -m bounded_formulas
PYTHONPATH=. python3 -m timecurve_sim --seeds 40 --top 8 --out output/timecurve_sweep.json
```

Use `python3 -m timecurve_sim --full-grid` for a larger grid (slower). Each TimeCurve run uses a fixed **observation horizon** (default 8h simulated time) so timer extensions cannot make the run unbounded; metrics favor **lower Gini**, **lower top-5% spend share**, and **lower labeled-whale spend share** among 500 agents with mixed budgets.

Optional CSV traces (folder is gitignored by default at repo root):

```bash
PYTHONPATH=. python3 -m bounded_formulas --out output
```

With a virtual environment, `pip install -e .` installs the `burrow-sim` console script.

## Pass/fail criteria

Each epoch must satisfy:

- Finite `R`, `S`, `e`, `C`, `m`; `e > 0`.
- `m ∈ [m_min, m_max]`, `C ∈ [0, c_max]`.
- `|e_{t+1} - e_t| ≤ delta_max_frac * e_t`.

Scenarios **good**, **bad**, **worst**, and **attack** exercise healthy flows, weak activity, bank-run stress, and oscillating whale behavior.

## Coverage clip note

`C = R / (S·e)` is clipped to **`[0, c_max]`** so tiny denominators do not explode the multiplier. The lower bound stays **0** so insolvency is not masked.

## Comeback

`bounded_formulas.comeback.faction_scores` always applies a **bounded** bonus to **trailing** factions (median-based trailing set). Adjust `eta` and `B_comeback` in scenario tests if tuning gameplay.

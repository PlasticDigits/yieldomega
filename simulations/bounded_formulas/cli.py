"""CLI: run scenario suite and print pass/fail."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from bounded_formulas.scenarios import run_all_scenarios


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Rabbit Treasury bounded-formula simulations (DOUB / Burrow)")
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Directory for CSV traces (default: no files)",
    )
    p.add_argument(
        "--fail-on-bad",
        action="store_true",
        help="Exit with code 1 if any scenario fails invariants",
    )
    args = p.parse_args(argv)

    results = run_all_scenarios(out_dir=args.out)
    ok = True
    for r in results:
        status = "PASS" if r.passed else "FAIL"
        line = f"{status}  {r.name:8s}  epochs={r.epochs:4d}  R={r.final.R:.6g}  S={r.final.S:.6g}  e={r.final.e:.6g}"
        if r.error:
            line += f"  err={r.error}"
        print(line)
        if not r.passed:
            ok = False

    if args.fail_on_bad and not ok:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

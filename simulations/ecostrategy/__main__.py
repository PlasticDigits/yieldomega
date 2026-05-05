"""CLI: reproducible EcoStrategy scenarios (GitLab #161)."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ecostrategy.constants import APPROXIMATIONS_AND_SCENARIO_ONLY, MIRRORED_FROM_CONTRACT
from ecostrategy.scenarios import SCENARIO_RUNNERS


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="EcoStrategy audit scenarios A–E — shark vs believer modeling (Python sim)",
    )
    ap.add_argument(
        "--scenario",
        choices=("A", "B", "C", "D", "E", "all"),
        default="all",
        help="Which scenario to run (default: all)",
    )
    ap.add_argument("--seed", type=int, default=42, help="RNG seed (default 42)")
    ap.add_argument("--population", type=int, default=240, help="Synthetic wallets")
    ap.add_argument("--horizon-sec", type=float, default=28_800.0, help="Observation window")
    ap.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Write JSON report (metrics + manifest of mirrored constants)",
    )
    args = ap.parse_args(argv)

    keys = ["A", "B", "C", "D", "E"] if args.scenario == "all" else [args.scenario]
    results = []
    for k in keys:
        fn = SCENARIO_RUNNERS[k]
        if k == "E":
            r = fn(seed=args.seed, population=max(1, args.population))
        else:
            r = fn(seed=args.seed, population=args.population, horizon_sec=args.horizon_sec)
        results.append(r.to_json_dict())

    payload = {
        "gitlab_issue": "https://gitlab.com/PlasticDigits/yieldomega/-/issues/161",
        "mirrored_from_contract": MIRRORED_FROM_CONTRACT,
        "approximations": APPROXIMATIONS_AND_SCENARIO_ONLY,
        "runs": results,
    }

    text = json.dumps(payload, indent=2)
    if args.out is not None:
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(text, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

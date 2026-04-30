#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate the TimeCurve / fee-sink conversion arrow via Replicate (gpt-image-2).

Uses the same auth and env loading as ``generate_assets.py``::

  cd scripts/replicate-art
  . .venv/bin/activate  # pip install -r requirements.txt
  export REPLICATE_API_TOKEN=r8_…
  python ui_conversion_arrow_batch.py
  python ui_conversion_arrow_batch.py --dry-run

Output is written to ``frontend/public/art/pending_manual_review/`` (gitignored)
as ``ui-conversion-arrow-replicate.png``. Compare with the committed SVG at
``frontend/public/art/icons/ui-conversion-arrow.svg``; if the PNG wins on QA,
replace the SVG reference in ``ConversionArrow.tsx`` or swap the asset after
manual review.

Run without a token exits non-zero unless ``--dry-run``.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--dry-run", action="store_true", help="Print plan only; no API calls")
    p.add_argument(
        "--wait-seconds",
        type=int,
        default=1,
        metavar="SEC",
        help="Replicate Prefer: wait (1–60, default 1)",
    )
    p.add_argument(
        "--retry-max",
        type=int,
        default=8,
        metavar="N",
        help="Retries on transient API errors (default 8)",
    )
    args = p.parse_args()

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print(
            "Error: REPLICATE_API_TOKEN is not set.\n"
            "Add it to .env (repo root, scripts/replicate-art/.env, or frontend/.env / .env.local).",
            file=sys.stderr,
        )
        return 1
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    out_dir = ga.REPO_ROOT / "frontend" / "public" / "art" / "pending_manual_review"
    subject = (
        "Single isolated UI micro-graphic: a chunky arcade-style RIGHT-pointing conversion arrow "
        "(short horizontal shaft on the left, triangular arrowhead on the right) used between token tickers. "
        "Thick black outer outline, deep forest-green fill matching the reference emeralds, "
        "small glossy gold rim-light on the top edge like the hat-token trim. Toy HUD / vending-machine "
        "clarity; centered with generous empty margin so it reads at 16–24px. "
        "No characters, no coin discs, no letters, no watermarks, no full circular badge frame."
    )

    wait = ga.clamp_prefer_wait(args.wait_seconds)
    ga.run_job(
        name="ui-conversion-arrow-replicate",
        aspect_ratio="1:1",
        output_format="png",
        background="transparent",
        subject=subject,
        out_dir=out_dir,
        style_ref=ga.DEFAULT_STYLE_REF,
        token_ref=ga.DEFAULT_TOKEN_REF,
        quality="high",
        moderation="low",
        output_compression=92,
        prefer_wait=wait,
        retry_max=args.retry_max,
        retry_delay_sec=20.0,
        dry_run=args.dry_run,
        no_refs=False,
        custom_prompt=None,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

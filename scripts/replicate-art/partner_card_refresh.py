#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Re-render Kumbaya + Sir production cards via Replicate (openai/gpt-image-2).

Preserves partner-approved layout and characters from the current card images; improves finish and
aligns the Doubloon (DOUB) coin / shield marks with `frontend/public/art/token-logo.png`.

Reference order for each run: `style.png`, `token-logo.png`, then the existing production card.

  cd scripts/replicate-art
  . venv or: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
  .venv/bin/python partner_card_refresh.py
  .venv/bin/python partner_card_refresh.py --sir-only
  .venv/bin/python partner_card_refresh.py --dry-run

Environment: REPLICATE_API_TOKEN (see `generate_assets.load_env()`).

Outputs:
  - Default: `frontend/public/art/pending_manual_review/partner_regen/`
  - `--in-place`: writes `kumbaya-card.jpg` and `sir-card.png` under `public/art/` (backups in pending_manual_review)

Each image: **one API attempt** (no client-side retries; failed runs are not re-submitted). Polls the same
Replicate prediction until it finishes or **--max-seconds** (default **360**) elapses, then cancels and errors.
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
import time
from datetime import date
from pathlib import Path

if __name__ == "__main__" and __package__ is None:  # pragma: no cover
    _script = Path(__file__).resolve()
    if str(_script.parent) not in sys.path:
        sys.path.insert(0, str(_script.parent))

import generate_assets as ga  # noqa: E402

DEFAULT_SLEEP_SEC = 22.0
# Single attempt, hard deadline — avoids stacking $0.13+ charges on flaky connections.
DEFAULT_RETRY_MAX = 1
DEFAULT_MAX_WALL_SECONDS = 360.0


def _backup(src: Path, backup_dir: Path) -> Path:
    backup_dir.mkdir(parents=True, exist_ok=True)
    stamp = date.today().isoformat()
    out = backup_dir / f"{src.name}.bak-{stamp}"
    n = 1
    while out.exists():
        out = backup_dir / f"{src.name}.bak-{stamp}-{n}"
        n += 1
    shutil.copy2(src, out)
    return out


def _run_card(
    *,
    slug: str,
    out_dir: Path,
    dry_run: bool,
    retry_max: int,
    max_wall_seconds: float,
) -> None:
    if slug == "kumbaya":
        card = ga.DEFAULT_KUMBAYA_CARD_REF
        name = "kumbaya-card"
        aspect = "3:2"
        fmt = "jpeg"
        bg = "opaque"
        notes = (
            "Kumbaya spot-liquidity card: keep the vat, pipes, coin stacks, and character staging from the card reference. "
            "Cheerful pool / celebration energy only — same approved moment."
        )
    elif slug == "sir":
        card = ga.DEFAULT_SIR_PRODUCTION_CARD_REF
        name = "sir-card"
        aspect = "3:2"
        fmt = "png"
        bg = "opaque"
        notes = (
            "Sir third-party venue card: keep the counter, merchant gorilla, leprechaun customer, bunting, "
            "and trophy placement from the card reference. Same market scene — refined render only.\n"
            "Doubloon (DOUB) brand fix: replace any off-model coin or shield D with the exact hat+D emblem from token-logo — "
            "green hat, yellow band, bold stylized D. The counter/green runner shield plaque and every visible coin must match that mark."
        )
    else:
        raise ValueError(slug)

    if not card.is_file():
        print(f"Missing card reference: {card}", file=sys.stderr)
        raise SystemExit(1)

    prompt = ga.build_partner_card_refresh_prompt(
        which=slug,
        subject_notes=notes,
    )
    # Issue #45 parity: high quality, permissive moderation for approved partner refs
    ga.run_job(
        name,
        aspect,
        fmt,
        bg,
        "",
        out_dir,
        ga.DEFAULT_STYLE_REF,
        ga.DEFAULT_TOKEN_REF,
        "high",
        "low",
        95,
        60,
        retry_max,
        20.0,
        dry_run,
        False,
        custom_prompt=prompt,
        ref_paths_override=[ga.DEFAULT_STYLE_REF, ga.DEFAULT_TOKEN_REF, card],
        max_wall_seconds=max_wall_seconds,
        log_monitor=True,
        poll_progress=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--kumbaya-only", action="store_true")
    ap.add_argument("--sir-only", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument(
        "--in-place",
        action="store_true",
        help="Write kumbaya-card.jpg and sir-card.png in public/art/ (backups in pending_manual_review).",
    )
    ap.add_argument(
        "--sleep",
        type=float,
        default=DEFAULT_SLEEP_SEC,
        help=f"Seconds between API jobs (default {DEFAULT_SLEEP_SEC}).",
    )
    ap.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Override output directory (default: pending manual review or in-place).",
    )
    ap.add_argument(
        "--max-seconds",
        type=float,
        default=DEFAULT_MAX_WALL_SECONDS,
        metavar="SEC",
        help=f"Max wall time per prediction; cancel and fail if not done (default {DEFAULT_MAX_WALL_SECONDS:.0f}).",
    )
    ap.add_argument(
        "--retry-max",
        type=int,
        default=DEFAULT_RETRY_MAX,
        help=f"Client-side API attempts per card (default {DEFAULT_RETRY_MAX}: no retries).",
    )
    args = ap.parse_args()
    if args.retry_max < 1:
        print("--retry-max must be >= 1", file=sys.stderr)
        return 1
    if args.max_seconds < 60.0:
        print("--max-seconds must be at least 60 (Replicate + model minimum).", file=sys.stderr)
        return 1

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print(
            "REPLICATE_API_TOKEN is not set. Add to .env (repo root, scripts/replicate-art/.env, or frontend/.env).",
            file=sys.stderr,
        )
        return 1
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    if args.kumbaya_only and args.sir_only:
        print("Use only one of --kumbaya-only / --sir-only", file=sys.stderr)
        return 1

    if args.kumbaya_only:
        slugs = ("kumbaya",)
    elif args.sir_only:
        slugs = ("sir",)
    else:
        slugs = ("kumbaya", "sir")

    art = ga.REPO_ROOT / "frontend" / "public" / "art"
    if args.output_dir is not None:
        out_dir = args.output_dir
    elif args.in_place:
        out_dir = art
    else:
        out_dir = art / "pending_manual_review" / "partner_regen"

    backup_dir = art / "pending_manual_review" / "partner_regen_backups"
    for slug in slugs:
        p = ga.DEFAULT_KUMBAYA_CARD_REF if slug == "kumbaya" else ga.DEFAULT_SIR_PRODUCTION_CARD_REF
        if args.in_place and p.is_file() and not args.dry_run:
            b = _backup(p, backup_dir)
            print(f"Backed up {p} -> {b}", file=sys.stderr)

    for i, slug in enumerate(slugs):
        print(f"=== {slug} card -> {out_dir} ===", file=sys.stderr)
        _run_card(
            slug=slug,
            out_dir=out_dir,
            dry_run=args.dry_run,
            retry_max=args.retry_max,
            max_wall_seconds=args.max_seconds,
        )
        if i < len(slugs) - 1 and args.sleep > 0 and not args.dry_run:
            time.sleep(args.sleep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

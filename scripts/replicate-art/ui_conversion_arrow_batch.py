#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate the TimeCurve / fee-sink conversion arrow via Replicate (gpt-image-2).

Uses the same auth and env loading as ``generate_assets.py``::

  cd scripts/replicate-art
  . .venv/bin/activate  # pip install -r requirements.txt
  export REPLICATE_API_TOKEN=r8_…
  python ui_conversion_arrow_batch.py
  python ui_conversion_arrow_batch.py --dry-run
  python ui_conversion_arrow_batch.py --fetch-prediction-id <id>  # reuse a finished run

Output is written to ``frontend/public/art/pending_manual_review/`` (gitignored)
as ``ui-conversion-arrow-replicate.png``. Promote to
``frontend/public/art/icons/ui-conversion-arrow.png`` when QA looks good.

**Prefer: wait vs polling:** Replicate allows Prefer wait up to 60s, but long-held
HTTP creates often fail with ``RemoteProtocolError`` (proxy disconnects before
the server responds). This script caps ``--wait-seconds`` at {cap}s and relies on
client polling (see ``REPLICATE_MAX_GENERATION_SECONDS`` in ``generate_assets.py``)
for jobs that take minutes—no second prediction is created.

**Single attempt:** Default ``--retry-max`` is 1 so capacity-style retries do not
start duplicate generations; raise ``--retry-max`` only if you explicitly want
those retries.

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

# Above ~10s, many networks drop idle POST streams to Replicate before the
# prediction is accepted; use polling instead (same guidance as generate_assets.py).
SAFE_PREFER_WAIT_CAP = 10


def _download_url(url: str) -> bytes:
    try:
        import httpx
    except ImportError as exc:
        raise RuntimeError("httpx required for --fetch-prediction-id") from exc
    r = httpx.get(url, follow_redirects=True, timeout=120.0)
    r.raise_for_status()
    return r.content


def fetch_prediction_png(*, prediction_id: str, out_path: Path, dry_run: bool) -> int:
    """Pull first output file from a succeeded Replicate prediction."""
    try:
        import replicate
    except ImportError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    if dry_run:
        print(f"[dry-run] would fetch prediction {prediction_id!r} → {out_path}")
        return 0

    client = replicate.Client(api_token=os.environ.get("REPLICATE_API_TOKEN"))
    pred = client.predictions.get(prediction_id)
    if pred.status != "succeeded":
        print(
            f"Error: prediction {prediction_id!r} status={pred.status!r} (need succeeded).",
            file=sys.stderr,
        )
        return 1
    out = pred.output
    if not out:
        print(f"Error: prediction {prediction_id!r} has empty output.", file=sys.stderr)
        return 1
    url = out[0] if isinstance(out, (list, tuple)) else out
    if not isinstance(url, str) or not url.startswith("http"):
        print(f"Error: unexpected output shape: {out!r}", file=sys.stderr)
        return 1

    data = _download_url(url)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(data)
    print(f"Wrote {out_path} ({len(data)} bytes) from prediction {prediction_id}")
    return 0


def main() -> int:
    doc = __doc__.format(cap=SAFE_PREFER_WAIT_CAP) if __doc__ else ""
    p = argparse.ArgumentParser(
        description=doc,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--dry-run", action="store_true", help="Print plan only; no API calls")
    p.add_argument(
        "--fetch-prediction-id",
        metavar="ID",
        default=None,
        help="Download PNG from an existing succeeded prediction (no new generation)",
    )
    p.add_argument(
        "--wait-seconds",
        type=int,
        default=1,
        metavar="SEC",
        help=f"Replicate Prefer: wait header (default 1; capped at {SAFE_PREFER_WAIT_CAP}s here)",
    )
    p.add_argument(
        "--retry-max",
        type=int,
        default=1,
        metavar="N",
        help="Capacity-style retries inside generate_assets (default 1 = single job)",
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
    default_png = out_dir / "ui-conversion-arrow-replicate.png"

    if args.fetch_prediction_id:
        return fetch_prediction_png(
            prediction_id=args.fetch_prediction_id.strip(),
            out_path=default_png,
            dry_run=args.dry_run,
        )

    requested_wait = args.wait_seconds
    if requested_wait > SAFE_PREFER_WAIT_CAP:
        print(
            f"Note: --wait-seconds={requested_wait} exceeds safe cap {SAFE_PREFER_WAIT_CAP}s "
            "(long Prefer wait often triggers disconnected POST); using "
            f"{SAFE_PREFER_WAIT_CAP}s. Completion still uses polling up to "
            "REPLICATE_MAX_GENERATION_SECONDS.",
            file=sys.stderr,
        )
    wait = ga.clamp_prefer_wait(min(requested_wait, SAFE_PREFER_WAIT_CAP))

    subject = (
        "Single isolated UI micro-graphic: a chunky arcade-style RIGHT-pointing conversion arrow "
        "(short horizontal shaft on the left, triangular arrowhead on the right) used between token tickers. "
        "Thick black outer outline, deep forest-green fill matching the reference emeralds, "
        "small glossy gold rim-light on the top edge like the hat-token trim. Toy HUD / vending-machine "
        "clarity; centered with generous empty margin so it reads at 16–24px. "
        "No characters, no coin discs, no letters, no watermarks, no full circular badge frame."
    )

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

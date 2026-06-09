#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate Glass Arena Time Arena sub-nav pictograms.

Outputs replace the stable public asset paths used by ``ArenaSubnav``:

  frontend/public/art/icons/nav-simple.png   (BUY)
  frontend/public/art/icons/nav-protocol.png (AUDIT)

Prediction IDs are written to ``glass_arena_nav_icons.ledger.json`` so reconnects
do not duplicate Replicate jobs. Each slug gets one create attempt (no outer retries).
"""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import flagged_inputs as _flagged_inputs  # noqa: E402
import generate_assets as ga  # noqa: E402
import replicate_bounded_run as _bounded  # noqa: E402

LEDGER = SCRIPT_DIR / "glass_arena_nav_icons.ledger.json"
ART_ROOT = ga.REPO_ROOT / "frontend" / "public" / "art"
ICONS_DIR = ART_ROOT / "icons"
SCRATCH_DIR = ART_ROOT / "pending_manual_review" / "glass-arena-nav-icons"

GLASS_STYLE = """
Yield Omega Glass Arena sub-navigation pictogram.
Create a single square 256x256 transparent PNG icon for a compact BUY/AUDIT tab.
Deep navy glass material, emerald/teal live-state glow, warm gold DOUB reward
accents, sparse purple only for opponent energy. Cyberminimalist command-console
finish: crisp silhouette, luminous bevels, subtle glass reflections, no text,
no UI labels, no letters, no watermarks, no photorealism. Center the subject
with enough transparent padding to read clearly at 28px.
""".strip()


@dataclass(frozen=True)
class NavIconJob:
    slug: str
    filename: str
    subject: str


JOBS: tuple[NavIconJob, ...] = (
    NavIconJob(
        "nav-simple",
        "nav-simple.png",
        "BUY tab: calm play route — emerald dawn sun rising behind a soft glass hill, gentle gold horizon spark, welcoming default arena entry",
    ),
    NavIconJob(
        "nav-protocol",
        "nav-protocol.png",
        "AUDIT tab: technical verification route — teal glass shield crest with two interlocking gear cogs behind it, precise audit-console energy",
    ),
)


def _reference_paths(slug: str) -> list[Path]:
    refs = [
        ga.DEFAULT_TOKEN_REF,
        ga.REPO_ROOT / "frontend" / "public" / "tokens" / "doub.png",
        ICONS_DIR / "arena-podium-rank-first.png",
    ]
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=slug)


def _square_icon_png(raw: bytes) -> bytes:
    from PIL import Image

    im = Image.open(io.BytesIO(raw)).convert("RGBA")
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((side - w) // 2, (side - h) // 2))
    canvas = canvas.resize((256, 256), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _load_ledger() -> dict[str, str]:
    if not LEDGER.is_file():
        return {}
    try:
        data = json.loads(LEDGER.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}
    if not isinstance(data, dict):
        return {}
    return {str(k): str(v) for k, v in data.items() if v}


def _save_ledger(data: dict[str, str]) -> None:
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    tmp = LEDGER.with_suffix(LEDGER.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp.replace(LEDGER)


def _forget_ledger_keys(slugs: set[str]) -> None:
    data = _load_ledger()
    for slug in slugs:
        data.pop(slug, None)
    _save_ledger(data)


def _run_job(client: object, job: NavIconJob, *, no_refs: bool) -> None:
    prompt = ga.augment_prompt_chroma_backdrop(f"{GLASS_STYLE}\n\nSubject:\n{job.subject}")
    inp: dict = {
        "prompt": prompt,
        "aspect_ratio": "1:1",
        "quality": "high",
        "background": "opaque",
        "moderation": "low",
        "output_format": "png",
        "number_of_images": 1,
        "output_compression": 90,
        "input_images": [],
    }
    handles = [] if no_refs else [open(p, "rb") for p in _reference_paths(job.slug)]  # noqa: SIM115
    try:
        inp["input_images"] = handles
        output = _bounded.run_model_bounded(
            client,
            ga.MODEL,
            inp,
            prefer_wait=1,
            job_label=job.slug,
            ledger_path=LEDGER,
            ledger_key=job.slug,
            poll_progress=True,
        )
    finally:
        for handle in handles:
            handle.close()

    if not output:
        raise RuntimeError(f"no output for {job.slug}")
    raw = ga.postprocess_chroma_to_transparent(ga._read_output_bytes(output))
    raw = _square_icon_png(raw)

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    (SCRATCH_DIR / job.filename).write_bytes(raw)
    final = ICONS_DIR / job.filename
    final.write_bytes(raw)
    print(f"[{job.slug}] promoted {final.relative_to(ga.REPO_ROOT)} ({len(raw)} b)")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Print output paths without calling Replicate")
    parser.add_argument("--force-new", action="store_true", help="Forget ledger entries before creating")
    parser.add_argument("--no-refs", action="store_true", help="Skip reference images")
    parser.add_argument("--only", choices=[job.slug for job in JOBS], action="append", help="Generate only selected slug(s)")
    args = parser.parse_args()

    ga.load_env()
    selected = tuple(job for job in JOBS if not args.only or job.slug in set(args.only))
    if args.dry_run:
        for job in selected:
            print(f"{job.slug}\t{job.filename}")
        return 0
    if not os.environ.get("REPLICATE_API_TOKEN", "").strip():
        print("REPLICATE_API_TOKEN is unset; export it or add it to repo-root .env.", file=sys.stderr)
        return 2
    if args.force_new:
        _forget_ledger_keys({job.slug for job in selected})

    import replicate

    client = (
        replicate.Client(timeout=httpx.Timeout(120.0, connect=60.0, write=600.0, read=900.0, pool=300.0))
        if httpx is not None
        else replicate.Client()
    )
    for job in selected:
        _run_job(client, job, no_refs=args.no_refs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate Glass Arena CHARM and CRED token icons.

Outputs replace the stable public asset paths used by ``tokenMedia``:

  frontend/public/tokens/charm.png
  frontend/public/tokens/cred.png

Prediction IDs are written to ``glass_arena_token_icons.ledger.json`` so
reconnects or retries do not duplicate Replicate jobs.
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

LEDGER = SCRIPT_DIR / "glass_arena_token_icons.ledger.json"
TOKENS_DIR = ga.REPO_ROOT / "frontend" / "public" / "tokens"
SCRATCH_DIR = ga.REPO_ROOT / "frontend" / "public" / "art" / "pending_manual_review" / "glass-arena-token-icons"

TOKEN_STYLE = """
Yield Omega Glass Arena token icon.
Create a single square 256x256 transparent PNG token glyph for a premium
cyberminimalist command-console game UI. Deep navy glass core, emerald/teal rim
light, warm gold reward accents, chunky mobile-game silhouette, crisp readable
shape at 28px and 44px. No readable text, no letters, no numerals, no UI frame,
no watermark, no photorealism. Center the object with transparent padding.
""".strip()


@dataclass(frozen=True)
class TokenJob:
    slug: str
    filename: str
    subject: str


JOBS: tuple[TokenJob, ...] = (
    TokenJob(
        "charm",
        "charm.png",
        "CHARM token: luminous emerald charm medallion, playful lucky talisman silhouette, small gold clasp and jewel facets, feels like the asset received when buying in the arena",
    ),
    TokenJob(
        "cred",
        "cred.png",
        "Play CRED token: compact credit-chip badge, teal glass circuit facets with a warm gold core spark, distinct from CHARM, reads as earned gameplay credit rather than a medallion",
    ),
)


def _reference_paths(job: TokenJob) -> list[Path]:
    refs = [ga.DEFAULT_TOKEN_REF, TOKENS_DIR / "doub.png"]
    if job.slug == "charm":
        refs.append(TOKENS_DIR / "charm.png")
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=job.slug)


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


def _run_job(client: object, job: TokenJob, no_refs: bool) -> None:
    prompt = f"{TOKEN_STYLE}\n\n{job.subject}"
    inp: dict = {
        "prompt": ga.augment_prompt_chroma_backdrop(prompt),
        "aspect_ratio": "1:1",
        "quality": "high",
        "background": "opaque",
        "moderation": "low",
        "output_format": "png",
        "number_of_images": 1,
        "output_compression": 90,
        "input_images": [],
    }
    handles = [] if no_refs else [open(p, "rb") for p in _reference_paths(job)]  # noqa: SIM115
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
    TOKENS_DIR.mkdir(parents=True, exist_ok=True)
    (SCRATCH_DIR / job.filename).write_bytes(raw)
    final = TOKENS_DIR / job.filename
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
        _run_job(client, job, args.no_refs)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

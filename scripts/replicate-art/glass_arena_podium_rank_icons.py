#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate the three Glass Arena podium rank trophy icons.

Outputs replace the stable public asset paths used by ``PodiumRankingList``:

  frontend/public/art/icons/arena-podium-rank-first.png
  frontend/public/art/icons/arena-podium-rank-second.png
  frontend/public/art/icons/arena-podium-rank-third.png

Prediction IDs are written to ``glass_arena_podium_rank_icons.ledger.json`` so
reconnects or retries do not duplicate Replicate jobs.
"""

from __future__ import annotations

import argparse
import concurrent.futures
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

LEDGER = SCRIPT_DIR / "glass_arena_podium_rank_icons.ledger.json"
ART_ROOT = ga.REPO_ROOT / "frontend" / "public" / "art"
ICONS_DIR = ART_ROOT / "icons"
SCRATCH_DIR = ART_ROOT / "pending_manual_review" / "glass-arena-podium-rank-icons"

GLASS_TROPHY_STYLE = """
Yield Omega Glass Arena rank trophy icon.
Create a single square 256x256 transparent PNG trophy for an in-app podium row.
Deep navy glass and emerald command-console lighting, chunky premium mobile-game
silhouette, luminous bevels, warm gold/metal trophy material, tiny DOUB reward
spark accents, crisp readable shape at 44px. No readable text, no letters, no UI
frames, no watermarks, no photorealism. Center the trophy with transparent
padding so the whole object is visible when cropped into a 44px row glyph.
""".strip()


@dataclass(frozen=True)
class RankIconJob:
    slug: str
    filename: str
    subject: str


JOBS: tuple[RankIconJob, ...] = (
    RankIconJob(
        "first",
        "arena-podium-rank-first.png",
        "First place trophy: largest gold glass cup with a clear number-one champion silhouette, emerald rim light, celebratory gold sparks, no text or numerals",
    ),
    RankIconJob(
        "second",
        "arena-podium-rank-second.png",
        "Second place trophy: silver-blue glass cup, slightly smaller than first, teal glow, cool metal reflections, no text or numerals",
    ),
    RankIconJob(
        "third",
        "arena-podium-rank-third.png",
        "Third place trophy: bronze-copper glass cup, compact chunky shape, warm amber glow with emerald highlights, no text or numerals",
    ),
)


def _reference_paths(slug: str) -> list[Path]:
    refs = [
        ga.DEFAULT_TOKEN_REF,
        ga.REPO_ROOT / "frontend" / "public" / "tokens" / "doub.png",
        ICONS_DIR / f"arena-podium-rank-{slug}.png",
    ]
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=f"rank-{slug}")


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


def _run_job(job: RankIconJob, *, no_refs: bool) -> None:
    import replicate

    prompt = ga.augment_prompt_chroma_backdrop(f"{GLASS_TROPHY_STYLE}\n\nSubject:\n{job.subject}")
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
    client = (
        replicate.Client(
            timeout=httpx.Timeout(120.0, connect=60.0, write=600.0, read=900.0, pool=300.0),
        )
        if httpx is not None
        else replicate.Client()
    )
    refs = _reference_paths(job.slug)

    def call_model() -> object:
        if no_refs:
            return _bounded.run_model_bounded(
                client,
                ga.MODEL,
                inp,
                prefer_wait=1,
                job_label=f"podium-rank-{job.slug}",
                ledger_path=LEDGER,
                ledger_key=job.slug,
                poll_progress=True,
            )

        handles = [open(p, "rb") for p in refs]  # noqa: SIM115
        try:
            inp["input_images"] = handles
            return _bounded.run_model_bounded(
                client,
                ga.MODEL,
                inp,
                prefer_wait=1,
                job_label=f"podium-rank-{job.slug}",
                ledger_path=LEDGER,
                ledger_key=job.slug,
                poll_progress=True,
            )
        finally:
            for handle in handles:
                handle.close()

    output = call_model()
    if not output:
        raise RuntimeError(f"no output for podium-rank-{job.slug}")
    raw = ga.postprocess_chroma_to_transparent(ga._read_output_bytes(output))
    raw = _square_icon_png(raw)

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    (SCRATCH_DIR / job.filename).write_bytes(raw)
    final = ICONS_DIR / job.filename
    final.write_bytes(raw)
    print(f"[podium-rank-{job.slug}] promoted {final.relative_to(ga.REPO_ROOT)} ({len(raw)} b)")


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


def _seed_prediction_ids(predictions: list[str]) -> None:
    if not predictions:
        return
    valid_slugs = {job.slug for job in JOBS}
    data = _load_ledger()
    for item in predictions:
        if "=" not in item:
            raise ValueError(f"--prediction must be slug=id, got {item!r}")
        slug, prediction_id = item.split("=", 1)
        slug = slug.strip()
        prediction_id = prediction_id.strip()
        if slug not in valid_slugs:
            raise ValueError(f"unknown rank slug {slug!r}; expected one of {sorted(valid_slugs)}")
        if not prediction_id:
            raise ValueError(f"empty prediction id for {slug!r}")
        data[slug] = prediction_id
    _save_ledger(data)


def _forget_ledger_keys(slugs: list[str]) -> None:
    if not slugs:
        return
    data = _load_ledger()
    for slug in slugs:
        data.pop(slug, None)
    _save_ledger(data)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List the three jobs without calling Replicate")
    parser.add_argument("--max-workers", type=int, default=3, help="Parallel Replicate job cap")
    parser.add_argument("--no-refs", action="store_true", help="Skip token/trophy reference images")
    parser.add_argument("--only", action="append", default=[], help="Run one slug; may be passed multiple times")
    parser.add_argument(
        "--force-new",
        action="store_true",
        help="Forget selected ledger entries before creating predictions",
    )
    parser.add_argument(
        "--prediction",
        action="append",
        default=[],
        metavar="SLUG=ID",
        help="Attach a job to an existing Replicate prediction id and promote its output",
    )
    args = parser.parse_args()

    ga.load_env()
    jobs = [job for job in JOBS if not args.only or job.slug in args.only]
    unknown = sorted(set(args.only) - {job.slug for job in JOBS})
    if unknown:
        print(f"unknown rank slug(s): {', '.join(unknown)}", file=sys.stderr)
        return 2
    if args.dry_run:
        for job in jobs:
            print(f"{job.slug}\t{job.filename}")
        return 0

    if not os.environ.get("REPLICATE_API_TOKEN", "").strip():
        print("REPLICATE_API_TOKEN is unset; export it or add it to repo-root .env.", file=sys.stderr)
        return 2

    if args.force_new:
        _forget_ledger_keys([job.slug for job in jobs])
    _seed_prediction_ids(args.prediction)

    workers = max(1, min(args.max_workers, len(jobs)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_run_job, job, no_refs=args.no_refs) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            future.result()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate Glass Arena header bar icons.

Outputs replace the stable public asset paths used by ``RootLayout``:

  frontend/public/art/icons/header-arena.png
  frontend/public/art/icons/header-referrals.png
  frontend/public/art/icons/header-wallet-connect.png
  frontend/public/art/icons/header-music.png

Prediction IDs are written to ``glass_arena_header_icons.ledger.json`` so
reconnects do not duplicate Replicate jobs. Each icon gets one create attempt;
outer retries are intentionally omitted.
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

LEDGER = SCRIPT_DIR / "glass_arena_header_icons.ledger.json"
ART_ROOT = ga.REPO_ROOT / "frontend" / "public" / "art"
ICONS_DIR = ART_ROOT / "icons"
SCRATCH_DIR = ART_ROOT / "pending_manual_review" / "glass-arena-header-icons"

GLASS_HEADER_STYLE = """
Yield Omega Glass Arena header icon.
Create a single square 256x256 transparent PNG pictogram for a dense app header
bar (24–32 px display). Deep navy glass material, emerald/teal live-state glow,
warm gold DOUB reward accents, sparse purple only for opponent energy.
Cyberminimalist command-console finish: bold silhouette, luminous bevels, subtle
glass reflections, thick readable outline, minimal internal detail. No text, no
letters, no numerals, no UI frame, no watermark, no photorealism. Center the
subject with generous transparent padding.
""".strip()


@dataclass(frozen=True)
class HeaderIconJob:
    slug: str
    filename: str
    subject: str


JOBS: tuple[HeaderIconJob, ...] = (
    HeaderIconJob(
        "header-arena",
        "header-arena.png",
        "Time Arena: compact glass chronometer crown with two bold timer hands, emerald rim light, small gold DOUB orbit spark, strong stopwatch silhouette readable at 24px, no numerals",
    ),
    HeaderIconJob(
        "header-referrals",
        "header-referrals.png",
        "Referrals: three linked glass coin nodes in a small network graph, one central node connected to two smaller nodes below, emerald connectors, gold node cores, no currency symbols",
    ),
    HeaderIconJob(
        "header-wallet-connect",
        "header-wallet-connect.png",
        "Connect wallet: small glossy glass bifold wallet with clasp and one warm gold DOUB coin peeking out, compact rounded silhouette, emerald edge glow",
    ),
    HeaderIconJob(
        "header-music",
        "header-music.png",
        "Music toggle: single glass eighth-note with teal live glow and subtle gold highlight, playful but tactical, clear note stem and flag at tiny size",
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


def _run_job(job: HeaderIconJob, *, no_refs: bool) -> None:
    import replicate

    prompt = ga.augment_prompt_chroma_backdrop(f"{GLASS_HEADER_STYLE}\n\nSubject:\n{job.subject}")
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
                job_label=job.slug,
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
                job_label=job.slug,
                ledger_path=LEDGER,
                ledger_key=job.slug,
                poll_progress=True,
            )
        finally:
            for handle in handles:
                handle.close()

    output = call_model()
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
    parser.add_argument("--dry-run", action="store_true", help="List jobs without calling Replicate")
    parser.add_argument("--force-new", action="store_true", help="Forget ledger entries before creating")
    parser.add_argument("--max-workers", type=int, default=4, help="Parallel Replicate job cap")
    parser.add_argument("--no-refs", action="store_true", help="Skip token reference images")
    parser.add_argument(
        "--only",
        action="append",
        default=[],
        help="Run one slug; may be passed multiple times",
    )
    args = parser.parse_args()

    ga.load_env()
    jobs = [job for job in JOBS if not args.only or job.slug in args.only]
    if args.dry_run:
        for job in jobs:
            print(f"{job.slug}\t{job.filename}")
        return 0

    if not os.environ.get("REPLICATE_API_TOKEN", "").strip():
        print("REPLICATE_API_TOKEN is unset; export it or add it to repo-root .env.", file=sys.stderr)
        return 2

    if args.force_new:
        _forget_ledger_keys({job.slug for job in jobs})

    workers = max(1, min(args.max_workers, len(jobs)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_run_job, job, no_refs=args.no_refs) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            future.result()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

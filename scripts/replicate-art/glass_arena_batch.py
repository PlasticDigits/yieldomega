#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""YieldOmega Glass Arena — one-time character/scene batch (ledger-backed, parallel).

Generates up to 10 review assets into ``frontend/public/art/pending_manual_review/``.
Each job writes its prediction id to ``glass_arena_batch.ledger.json`` so reconnects
do not duplicate generations.

  cd scripts/replicate-art
  .venv/bin/python glass_arena_batch.py --dry-run
  .venv/bin/python glass_arena_batch.py --max-workers 10
"""

from __future__ import annotations

import argparse
import concurrent.futures
import io
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

import generate_assets as ga  # noqa: E402
import flagged_inputs as _flagged_inputs  # noqa: E402
import replicate_bounded_run as _bounded  # noqa: E402

LEDGER = SCRIPT_DIR / "glass_arena_batch.ledger.json"
PENDING = ga.REPO_ROOT / "frontend" / "public" / "art" / "pending_manual_review"


@dataclass(frozen=True)
class GlassArenaJob:
    slug: str
    filename: str
    aspect_ratio: str
    subject: str
    background: str = "transparent"
    output_format: str = "png"
    resize: str = "cutout"


JOBS: tuple[GlassArenaJob, ...] = (
    GlassArenaJob(
        "arena-host-full",
        "glass-arena-host-full-body.png",
        "2:3",
        "Yield Omega Glass Arena host character, full-body cutout, cyberminimalist navy console operator, emerald accent lighting, gold DOUB canister prop, transparent backdrop",
    ),
    GlassArenaJob(
        "arena-host-bust",
        "glass-arena-host-bust.png",
        "1:1",
        "Yield Omega Arena host head and shoulders bust for onboarding empty states, restrained glass aesthetic, teal rim light",
    ),
    GlassArenaJob(
        "podium-engineer-a",
        "glass-podium-engineer-a.png",
        "2:3",
        "Podium engineer mascot holding DOUB prize canister, emerald/teal accents, glass arena engineer uniform",
    ),
    GlassArenaJob(
        "podium-engineer-b",
        "glass-podium-engineer-b.png",
        "2:3",
        "Second podium engineer variant, warm gold DOUB highlights, navy tactical suit, transparent cutout",
    ),
    GlassArenaJob(
        "luck-familiar",
        "glass-luck-familiar.png",
        "1:1",
        "Luck familiar mascot for Glass Arena, subtle purple opponent accent only, playful but tactical",
    ),
    GlassArenaJob(
        "console-scene",
        "glass-arena-console-scene.png",
        "16:9",
        "Wide arena console scene backplate, deep navy glass architecture, emerald live states, gold reward accents, no text",
        background="opaque",
        resize="scene",
    ),
    GlassArenaJob(
        "podium-scene",
        "glass-podium-results-scene.png",
        "16:9",
        "Podium results scene with four prize bays, DOUB gold emphasis, glass panels, cyberminimalist",
        background="opaque",
        resize="scene",
    ),
    GlassArenaJob(
        "epoch-transition",
        "glass-epoch-transition-scene.png",
        "16:9",
        "Epoch transition scene, timer bay and podium silhouettes, emerald countdown glow",
        background="opaque",
        resize="scene",
    ),
    GlassArenaJob(
        "wallet-empty",
        "glass-wallet-profile-empty.png",
        "4:3",
        "Wallet profile empty-state scene, arena host bust, navy glass UI frames, no addresses",
        background="opaque",
        resize="scene",
    ),
    GlassArenaJob(
        "yo-doub-accent",
        "glass-yo-doub-accent-sheet.png",
        "1:1",
        "Small premium Y Omega and DOUB icon accent sheet, gold and teal on navy, minimal glyphs",
        background="opaque",
        resize="none",
    ),
)


def _refs(slug: str) -> list[Path]:
    refs = [ga.DEFAULT_STYLE_REF, ga.DEFAULT_TOKEN_REF]
    world = ga.REPO_ROOT / "assets" / "worldbuilding" / "yieldomega-glass-arena-reference.png"
    if world.is_file():
        refs.append(world)
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=slug)


def _run_job(job: GlassArenaJob, *, scratch: Path, no_refs: bool, retry_max: int, retry_delay: float) -> None:
    import replicate

    prompt = ga.build_prompt(job.subject)
    if job.background == "transparent":
        prompt = ga.augment_prompt_chroma_backdrop(prompt)
    api_bg = ga.api_background_for_replicate(job.background)
    out_fmt = ga.effective_output_format(job.output_format, job.background)
    ext = ga.format_to_ext(out_fmt)
    out_path = PENDING / f"{job.filename.rsplit('.', 1)[0]}.{ext}"

    inp: dict = {
        "prompt": prompt,
        "aspect_ratio": job.aspect_ratio,
        "quality": "high",
        "background": api_bg,
        "moderation": "low",
        "output_format": out_fmt,
        "number_of_images": 1,
        "output_compression": 90,
        "input_images": [],
    }
    ref_paths = _refs(job.slug)
    client = (
        replicate.Client(
            timeout=httpx.Timeout(120.0, connect=60.0, write=600.0, read=900.0, pool=300.0),
        )
        if httpx is not None
        else replicate.Client()
    )

    def call_model() -> object:
        if not no_refs:
            missing = [p for p in ref_paths if not p.is_file()]
            if missing:
                raise FileNotFoundError(f"{job.slug}: missing refs: {missing}")
            handles = [open(p, "rb") for p in ref_paths]  # noqa: SIM115
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
                for h in handles:
                    h.close()
        inp["input_images"] = []
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

    output = ga.run_with_retries(
        call_model, max_attempts=retry_max, base_delay_sec=retry_delay, job_label=job.slug
    )
    if not output:
        raise RuntimeError(f"no output for {job.slug}")
    raw = ga._read_output_bytes(output)
    if job.background == "transparent":
        raw = ga.postprocess_chroma_to_transparent(raw)
    if job.resize == "cutout" and out_fmt == "png":
        from PIL import Image

        im = Image.open(io.BytesIO(raw))
        w, h = im.size
        long_edge = max(w, h)
        if long_edge > 1024:
            scale = 1024 / long_edge
            im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        raw = buf.getvalue()
    scratch.mkdir(parents=True, exist_ok=True)
    PENDING.mkdir(parents=True, exist_ok=True)
    (scratch / f"{job.slug}.{ext}").write_bytes(raw)
    out_path.write_bytes(raw)
    print(f"[{job.slug}] delivered {out_path.relative_to(ga.REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List jobs only")
    parser.add_argument("--max-workers", type=int, default=10, help="Parallel prediction cap")
    parser.add_argument("--no-refs", action="store_true", help="Skip style/token reference images")
    parser.add_argument("--only", action="append", default=[], help="Run specific slug(s) only")
    args = parser.parse_args()

    ga.load_env()
    jobs = [j for j in JOBS if not args.only or j.slug in args.only]
    if args.dry_run:
        for j in jobs:
            print(f"{j.slug}\t{j.filename}\t{j.aspect_ratio}")
        return 0

    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN is unset — use --dry-run or export token first.", file=sys.stderr)
        return 2

    scratch = ga.REPO_ROOT / "frontend" / "public" / "art" / ".scratch" / "glass_arena_batch"
    workers = max(1, min(args.max_workers, len(jobs)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [
            pool.submit(
                _run_job,
                job,
                scratch=scratch,
                no_refs=args.no_refs,
                retry_max=8,
                retry_delay=20.0,
            )
            for job in jobs
        ]
        for fut in concurrent.futures.as_completed(futures):
            fut.result()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

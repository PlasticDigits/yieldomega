#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate sniper-shark mascot cutouts (transparent PNG) via Replicate (openai/gpt-image-2).

Delivers to ``frontend/public/art/cutouts/`` using the same stack as ``issue60_batch.py``:
magenta chroma backdrop + local keying, cutout long-edge cap 1024px.

  cd scripts/replicate-art
  .venv/bin/python sniper_shark_cutouts.py
  .venv/bin/python sniper_shark_cutouts.py --dry-run
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

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

ResizeMode = Literal["cutout", "none"]


@dataclass(frozen=True)
class CutoutJob:
    filename: str
    aspect_ratio: str
    background: str
    output_format: str
    resize: ResizeMode
    subject: str
    deliver_relative: str


def _art() -> Path:
    return ga.REPO_ROOT / "frontend" / "public" / "art"


def _refs_for_slug(slug: str) -> list[Path]:
    refs = [ga.DEFAULT_STYLE_REF, ga.DEFAULT_TOKEN_REF]
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=slug)


def _read_output_bytes(output: object) -> bytes:
    return ga._read_output_bytes(output)


def _run_cutout_job(
    job: CutoutJob, *, scratch_dir: Path, retry_max: int, retry_delay: float, no_refs: bool
) -> None:
    import replicate

    catalog_bg = job.background
    prompt = ga.build_prompt(job.subject)
    if catalog_bg == "transparent":
        prompt = ga.augment_prompt_chroma_backdrop(prompt)
    api_bg = ga.api_background_for_replicate(catalog_bg)
    out_fmt = ga.effective_output_format(job.output_format, catalog_bg)
    ext = ga.format_to_ext(out_fmt)
    stem = job.filename.rsplit(".", 1)[0]
    scratch_path = scratch_dir / f"{stem}.{ext}"

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
    ref_paths = _refs_for_slug(stem)
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
                raise FileNotFoundError("missing refs:\n  " + "\n  ".join(str(p) for p in missing))
            handles = [open(p, "rb") for p in ref_paths]
            try:
                inp["input_images"] = handles
                return _bounded.run_model_bounded(client, ga.MODEL, inp, prefer_wait=1, job_label=stem)
            finally:
                for h in handles:
                    h.close()
        inp["input_images"] = []
        return _bounded.run_model_bounded(client, ga.MODEL, inp, prefer_wait=1, job_label=stem)

    output = ga.run_with_retries(
        call_model, max_attempts=retry_max, base_delay_sec=retry_delay, job_label=stem
    )
    if not output:
        raise RuntimeError(f"no output for {stem}")
    raw = _read_output_bytes(output)
    if catalog_bg == "transparent":
        raw = ga.postprocess_chroma_to_transparent(raw)
    if job.resize == "cutout" and out_fmt == "png":
        import io

        from PIL import Image

        im = Image.open(io.BytesIO(raw))
        w, h = im.size
        long_edge = max(w, h)
        if long_edge > 1024:
            s = 1024 / long_edge
            im = im.resize((max(1, int(w * s)), max(1, int(h * s))), Image.Resampling.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        raw = buf.getvalue()
    scratch_dir.mkdir(parents=True, exist_ok=True)
    scratch_path.write_bytes(raw)
    final = _art() / job.deliver_relative
    final.parent.mkdir(parents=True, exist_ok=True)
    final.write_bytes(raw)
    print(f"promoted {job.deliver_relative} ({len(raw)} b)")


def jobs() -> list[CutoutJob]:
    base = "Full body anthropomorphic **shark** character in the same blocky arcade-cartoon game style as the references: "
    fin = (
        " chunky dark outlines, glossy toy shading, friendly expressive face, clearly adult cartoon game character. "
        "Arcade fantasy **sharpshooter** / sniper-fantasy theme — props are clearly toylike and non-realistic, no gore, "
        "no photorealism. Character cutout for UI compositing, single figure centered, **alpha background** quality, no text."
    )
    return [
        CutoutJob(
            "sniper-shark-ghillie-prone.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "lying prone in a goofy ghillie suit hood with fronds, **scoped long toy rifle** forward, muzzle in soft "
            "cartoon proportions, relaxed fierce grin."
            + fin,
            "cutouts/sniper-shark-ghillie-prone.png",
        ),
        CutoutJob(
            "sniper-shark-tactical-kneel.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "one-knee kneel aiming, **tactical chest rig** with pouches and carabiners, fin ears up, visor cap, **scoped rifle** held steady."
            + fin,
            "cutouts/sniper-shark-tactical-kneel.png",
        ),
        CutoutJob(
            "sniper-shark-cool-suit-headset.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "confident standing pose, **slim dark wetsuit** with subtle green and gold trim, aviator **sunglasses**, "
            "comms **headset** with mic boom, rifle slung on back, arms crossed with swagger."
            + fin,
            "cutouts/sniper-shark-cool-suit-headset.png",
        ),
        CutoutJob(
            "sniper-shark-diver-harpoon.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "**diving rebreather** mask, snorkel, and buoy float clipped on—underwater op vibe—holding a chunky toy "
            "**harpoon gun** with scope, fins on feet, dynamic swim-ready stance."
            + fin,
            "cutouts/sniper-shark-diver-harpoon.png",
        ),
        CutoutJob(
            "sniper-shark-coin-bandolier.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "**green beret** with a tiny round hat-coin accent matching token-logo, **bandolier of glossy gold coin rounds**, "
            "tactical vest, aiming binoculars, rifle at hip."
            + fin,
            "cutouts/sniper-shark-coin-bandolier.png",
        ),
        CutoutJob(
            "sniper-shark-spotter-crouch.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "crouched **spotter** pose with oversized **field binoculars** to eyes, **rifle** on back, knee pads, small radio pouch."
            + fin,
            "cutouts/sniper-shark-spotter-crouch.png",
        ),
        CutoutJob(
            "sniper-shark-victory-medal.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "triumphant one-arm raised, **gold medal** on a ribbon, rifle slung, toothy happy grin, small confetti sprinkles, celebration pose."
            + fin,
            "cutouts/sniper-shark-victory-medal.png",
        ),
        CutoutJob(
            "sniper-shark-peek-scope.png",
            "1:1",
            "transparent",
            "png",
            "cutout",
            base
            + "peeking from the side in a sly crouch, **huge cartoon scope** close to one eye, finger on trigger, tail sweeping for balance, playful stealth."
            + fin,
            "cutouts/sniper-shark-peek-scope.png",
        ),
    ]


def main() -> int:
    p = argparse.ArgumentParser(description="Sniper-shark cutouts for art/cutouts")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-existing", action="store_true")
    p.add_argument("--sleep", type=float, default=22.0, help="Seconds between API jobs (default 22)")
    p.add_argument("--no-ref-images", action="store_true")
    args = p.parse_args()

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

    scratch = ga.REPO_ROOT / "frontend" / "public" / "art" / "pending_manual_review" / "sniper-shark-gen"
    scratch.mkdir(parents=True, exist_ok=True)

    job_list = jobs()
    for idx, job in enumerate(job_list):
        final = _art() / job.deliver_relative
        if args.skip_existing and final.is_file():
            print(f"skip {final.name}")
            continue
        print(f"[{idx + 1}/{len(job_list)}] {job.filename}")
        if args.dry_run:
            continue
        _run_cutout_job(job, scratch_dir=scratch, retry_max=8, retry_delay=20.0, no_refs=args.no_ref_images)
        if idx < len(job_list) - 1 and args.sleep > 0:
            time.sleep(args.sleep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

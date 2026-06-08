#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Regenerate the four Glass Arena podium icons.

Outputs replace the stable public asset paths used by
``ArenaSimplePodiumSection``:

  frontend/public/art/icons/arena-podium-last-buy.png
  frontend/public/art/icons/arena-podium-warbow.png
  frontend/public/art/icons/arena-podium-defended-streak.png
  frontend/public/art/icons/arena-podium-time-booster.png

Prediction IDs are written to ``glass_arena_podium_icons.ledger.json`` so
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

LEDGER = SCRIPT_DIR / "glass_arena_podium_icons.ledger.json"
ART_ROOT = ga.REPO_ROOT / "frontend" / "public" / "art"
ICONS_DIR = ART_ROOT / "icons"
SCRATCH_DIR = ART_ROOT / "pending_manual_review" / "glass-arena-podium-icons"

GLASS_STYLE = """
Yield Omega Glass Arena production icon.
Create a single square 256x256 transparent PNG icon for an in-app podium card.
Deep navy glass material, emerald/teal live-state glow, warm gold DOUB reward
accents, sparse purple only for opponent energy. Cyberminimalist command-console
finish: crisp silhouettes, luminous bevels, subtle glass reflections, no text,
no UI labels, no letters, no watermarks, no photorealism. Center the subject
with enough transparent padding to read at 70px.
""".strip()


@dataclass(frozen=True)
class PodiumIconJob:
    slug: str
    filename: str
    subject: str


JOBS: tuple[PodiumIconJob, ...] = (
    PodiumIconJob(
        "last-buy",
        "arena-podium-last-buy.png",
        "Last Buy podium: three sleek buyer silhouettes racing toward a glowing central timer crown, gold DOUB prize ring behind them",
    ),
    PodiumIconJob(
        "warbow",
        "arena-podium-warbow.png",
        "WarBow podium: stylized energy bow and shield crossing over a purple rival spark, gold DOUB canister at the base",
    ),
    PodiumIconJob(
        "defended-streak",
        "arena-podium-defended-streak.png",
        "Defended Streak podium: emerald glass shield protecting a stacked podium core, tiny gold reward sparks orbiting",
    ),
    PodiumIconJob(
        "time-booster",
        "arena-podium-time-booster.png",
        "Time Booster podium: teal chronometer turbine pushing a glowing timer needle forward, gold DOUB halo, motion streaks",
    ),
)


def _reference_paths(slug: str) -> list[Path]:
    refs = [
        ga.DEFAULT_TOKEN_REF,
        ga.REPO_ROOT / "frontend" / "public" / "tokens" / "doub.png",
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


def _run_job(job: PodiumIconJob, *, no_refs: bool) -> None:
    import replicate

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
                job_label=f"podium-{job.slug}",
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
                job_label=f"podium-{job.slug}",
                ledger_path=LEDGER,
                ledger_key=job.slug,
                poll_progress=True,
            )
        finally:
            for handle in handles:
                handle.close()

    # Do not retry create+poll as a whole: a network timeout during create can
    # happen after Replicate accepted the prediction but before the id is
    # returned/ledgered. Retrying that outer call creates duplicate images.
    output = call_model()
    if not output:
        raise RuntimeError(f"no output for podium-{job.slug}")
    raw = ga.postprocess_chroma_to_transparent(ga._read_output_bytes(output))
    raw = _square_icon_png(raw)

    SCRATCH_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    (SCRATCH_DIR / job.filename).write_bytes(raw)
    final = ICONS_DIR / job.filename
    final.write_bytes(raw)
    print(f"[podium-{job.slug}] promoted {final.relative_to(ga.REPO_ROOT)} ({len(raw)} b)")


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
            raise ValueError(f"unknown podium slug {slug!r}; expected one of {sorted(valid_slugs)}")
        if not prediction_id:
            raise ValueError(f"empty prediction id for {slug!r}")
        data[slug] = prediction_id
    _save_ledger(data)


def _watch_extra_predictions(prediction_ids: list[str]) -> None:
    if not prediction_ids:
        return
    import replicate

    client = (
        replicate.Client(
            timeout=httpx.Timeout(120.0, connect=60.0, write=600.0, read=900.0, pool=300.0),
        )
        if httpx is not None
        else replicate.Client()
    )
    for prediction_id in prediction_ids:
        prediction = client.predictions.get(prediction_id)
        label = f"extra-{prediction_id}"
        print(f"[{label}] monitoring existing prediction {prediction_id}")
        _bounded.wait_prediction_bounded(
            prediction,
            client,
            max_seconds=_bounded.max_generation_seconds(),
            job_label=label,
            poll_progress=True,
        )
        print(f"[{label}] status={prediction.status!r}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="List the four jobs without calling Replicate")
    parser.add_argument("--max-workers", type=int, default=4, help="Parallel Replicate job cap")
    parser.add_argument("--no-refs", action="store_true", help="Skip token reference images")
    parser.add_argument("--only", action="append", default=[], help="Run one slug; may be passed multiple times")
    parser.add_argument(
        "--prediction",
        action="append",
        default=[],
        metavar="SLUG=ID",
        help="Attach a job to an existing Replicate prediction id and promote its output",
    )
    parser.add_argument(
        "--watch-extra",
        action="append",
        default=[],
        metavar="ID",
        help="Wait for an existing prediction id without promoting it",
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

    _seed_prediction_ids(args.prediction)
    _watch_extra_predictions(args.watch_extra)

    workers = max(1, min(args.max_workers, len(jobs)))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(_run_job, job, no_refs=args.no_refs) for job in jobs]
        for future in concurrent.futures.as_completed(futures):
            future.result()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

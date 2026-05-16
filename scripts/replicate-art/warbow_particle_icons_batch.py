#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate transparent WarBow particle icons in parallel via Replicate."""

from __future__ import annotations

import argparse
import io
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore[misc, assignment]


OUT_DIR = ga.DEFAULT_OUT / "icons"
ICON_SIZE_PX = 256


@dataclass(frozen=True)
class WarbowParticleIconJob:
    slug: str
    title: str
    subject: str


def jobs() -> list[WarbowParticleIconJob]:
    return [
        WarbowParticleIconJob(
            "warbow-particle-shield",
            "WarBow shield particle",
            "A compact fantasy shield icon with emerald face, gold rim, chunky dark outline, small magical highlight, strong readable silhouette, no letters, no words.",
        ),
        WarbowParticleIconJob(
            "warbow-particle-bow",
            "WarBow bow particle",
            "A compact curved battle bow icon with taut glowing string, emerald-gold wood, tiny sparkle accent, chunky dark outline, strong readable silhouette, no arrows flying, no letters, no words.",
        ),
        WarbowParticleIconJob(
            "warbow-particle-sword",
            "WarBow sword particle",
            "A compact heroic sword icon angled upward with bright silver blade, emerald-gold hilt, chunky dark outline, small magical highlight, strong readable silhouette, no blood, no letters, no words.",
        ),
    ]


def build_prompt(job: WarbowParticleIconJob, *, using_refs: bool) -> str:
    refs = (
        "Reference images are supplied as input_images: style.png for the YieldOmega blocky arcade world and token-logo.png for the glossy green-gold finish."
        if using_refs
        else "No reference images are available; follow the written YieldOmega arcade-cartoon style closely."
    )
    return f"""
{ga.STYLE_GUIDE}

{refs}

WarBow particle icon constraints:
- Produce exactly one standalone pictogram centered in the frame.
- Transparent background after local chroma-key processing; do not draw a panel, card, label, border, floor, scenery, shadow blob, or UI chrome behind it.
- No readable text, no letters, no numbers, no watermark, no caption.
- Use a bold silhouette, thick dark outline, high contrast, minimal internal detail, and clear legibility at 20-48 px.
- Keep the design square, balanced, and uncluttered with generous empty space around the subject.

Icon: {job.title}
Subject:
{job.subject}

Strictly avoid:
{ga.NEGATIVE_GUIDE}
""".strip()


def normalize_icon(path: Path) -> None:
    if Image is None:
        return
    with Image.open(path) as src:
        im = src.convert("RGBA")
    alpha = im.getchannel("A")
    bbox = alpha.getbbox()
    if bbox:
        im = im.crop(bbox)
    max_side = max(im.size)
    pad = max(1, int(max_side * 0.2))
    canvas_side = max_side + pad * 2
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    canvas.alpha_composite(im, ((canvas_side - im.width) // 2, (canvas_side - im.height) // 2))
    canvas = canvas.resize((ICON_SIZE_PX, ICON_SIZE_PX), Image.Resampling.LANCZOS)
    scrub_magenta_pixels(canvas)
    buf = io.BytesIO()
    canvas.save(buf, format="PNG", optimize=True)
    path.write_bytes(buf.getvalue())


def write_manifest(selected: list[WarbowParticleIconJob], *, using_refs: bool) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "model": ga.MODEL,
        "output_dir": str(OUT_DIR.relative_to(ga.REPO_ROOT)),
        "single_attempt_per_image": True,
        "parallel": True,
        "transparent_background": True,
        "icon_size_px": ICON_SIZE_PX,
        "reference_images_used": using_refs,
        "jobs": [
            {
                "slug": job.slug,
                "title": job.title,
                "output": f"{job.slug}.png",
                "subject": job.subject,
            }
            for job in selected
        ],
    }
    (OUT_DIR / "warbow-particle-icons-prompts.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    (OUT_DIR / "warbow-particle-icons-README.md").write_text(
        "# WarBow Particle Icons\n\n"
        "Generated with `scripts/replicate-art/warbow_particle_icons_batch.py` using one Replicate create attempt per icon. "
        "The script runs the shield, bow, and sword jobs in parallel and normalizes each transparent PNG to 256x256.\n",
        encoding="utf-8",
    )


def output_bytes(output: object) -> bytes:
    first = output[0] if isinstance(output, (list, tuple)) else output
    if hasattr(first, "read"):
        data = first.read()
        if isinstance(data, bytes):
            return data
        raise RuntimeError(f"read() did not return bytes: {type(data)}")
    if isinstance(first, str):
        if ga.httpx is None:
            raise RuntimeError("httpx is required to download prediction output URLs")
        with ga.httpx.Client(timeout=ga.httpx.Timeout(120.0, connect=60.0)) as client:
            response = client.get(first)
            response.raise_for_status()
            return response.content
    raise RuntimeError(f"Unexpected output type: {type(first)}")


def scrub_magenta_pixels(im: object) -> None:
    pixels = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = pixels[x, y]
            is_magenta_screen = r >= 170 and b >= 150 and g <= 95 and abs(r - b) <= 110
            if is_magenta_screen:
                pixels[x, y] = (0, 0, 0, 0)


def postprocess_icon_chroma(data: bytes) -> bytes:
    """Remove Replicate's flat magenta screen, including anti-aliased edges."""
    data = ga.postprocess_chroma_to_transparent(data)
    if Image is None:
        return data
    with Image.open(io.BytesIO(data)) as src:
        im = src.convert("RGBA")
    scrub_magenta_pixels(im)
    buf = io.BytesIO()
    im.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def pull_one_prediction(spec: str) -> int:
    if ":" not in spec:
        print("Error: --pull-one expects slug:prediction_id", file=sys.stderr)
        return 2
    slug, prediction_id = (part.strip() for part in spec.split(":", 1))
    if not slug or not prediction_id:
        print("Error: --pull-one expects slug:prediction_id", file=sys.stderr)
        return 2

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN unset.", file=sys.stderr)
        return 1
    os.environ["REPLICATE_API_TOKEN"] = token

    import replicate

    client = replicate.Client()
    prediction = client.predictions.get(prediction_id)
    if prediction.status != "succeeded":
        print(f"Prediction {prediction_id} is {prediction.status!r}, not 'succeeded'.", file=sys.stderr)
        return 3
    out_path = OUT_DIR / f"{slug}.png"
    if out_path.exists():
        print(f"Refusing to overwrite existing output: {out_path}", file=sys.stderr)
        return 2
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_bytes(postprocess_icon_chroma(output_bytes(prediction.output)))
    normalize_icon(out_path)
    print(f"Pulled {prediction_id} to {out_path}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pull-one", default="", help="Download an existing successful prediction as slug:prediction_id without creating a new one.")
    args = parser.parse_args()
    if args.pull_one.strip():
        return pull_one_prediction(args.pull_one.strip())

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN unset.", file=sys.stderr)
        return 1
    os.environ["REPLICATE_API_TOKEN"] = token

    selected = jobs()
    using_refs = ga.DEFAULT_STYLE_REF.is_file() and ga.DEFAULT_TOKEN_REF.is_file()
    write_manifest(selected, using_refs=using_refs)

    existing = [OUT_DIR / f"{job.slug}.png" for job in selected if (OUT_DIR / f"{job.slug}.png").exists()]
    if existing:
        print("Refusing to run with existing WarBow particle icon PNGs; remove them first for a fresh one-attempt set.", file=sys.stderr)
        for path in existing:
            print(f"  existing: {path}", file=sys.stderr)
        return 2

    def run_one(idx: int, job: WarbowParticleIconJob) -> Path:
        print(f"[{idx}/{len(selected)}] {job.slug}")
        out = ga.run_job(
            job.slug,
            "1:1",
            "png",
            "transparent",
            job.subject,
            OUT_DIR,
            ga.DEFAULT_STYLE_REF,
            ga.DEFAULT_TOKEN_REF,
            "high",
            "low",
            90,
            1,
            1,
            20.0,
            False,
            not using_refs,
            custom_prompt=build_prompt(job, using_refs=using_refs),
            max_wall_seconds=float(os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "900")),
            log_monitor=True,
            poll_progress=True,
        )
        if out is None:
            raise RuntimeError(f"No output path for {job.slug}")
        out.write_bytes(postprocess_icon_chroma(out.read_bytes()))
        normalize_icon(out)
        return out

    with ThreadPoolExecutor(max_workers=len(selected)) as executor:
        futures = {executor.submit(run_one, idx, job): job.slug for idx, job in enumerate(selected, start=1)}
        for future in as_completed(futures):
            slug = futures[future]
            try:
                path = future.result()
                print(f"[{slug}] complete: {path}")
            except Exception as exc:
                print(f"[{slug}] failed: {exc!s}", file=sys.stderr)
                raise

    print(f"Wrote WarBow particle icons to {OUT_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate and normalize the frontend cursor pack.

The Replicate path sends the Yieldomega style references plus the MDN
"unstyled" cursor example for the requested CSS cursor role. When
REPLICATE_API_TOKEN is unavailable, the script still promotes small local
fallbacks so the frontend never ships oversized cursor bitmaps.

Run from repo root or scripts/replicate-art::

  python3 scripts/replicate-art/cursor_batch.py --derivatives-only
  python3 scripts/replicate-art/cursor_batch.py --fetch-examples
  python3 scripts/replicate-art/cursor_batch.py
"""

from __future__ import annotations

import argparse
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
from dataclasses import dataclass
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

try:
    from PIL import Image, ImageDraw
except ImportError:
    Image = None  # type: ignore[misc, assignment]
    ImageDraw = None  # type: ignore[misc, assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import flagged_inputs as _flagged_inputs  # noqa: E402
import generate_assets as ga  # noqa: E402
import replicate_bounded_run as _bounded  # noqa: E402


CURSOR_SIZE = 32
FALLBACK_INPUTS = {
    "default": "primary-cta.png",
    "grab": "slider-grab.png",
    "wait": "text-caret.png",
}


@dataclass(frozen=True)
class CursorJob:
    slug: str
    css_name: str
    fallback: str
    hotspot: tuple[int, int]
    mdn_url: str
    subject: str

    @property
    def filename(self) -> str:
        return f"{self.slug}.png"


def art_root() -> Path:
    return ga.REPO_ROOT / "frontend" / "public" / "art"


def cursor_dir() -> Path:
    return art_root() / "cursors"


def example_dir() -> Path:
    return art_root() / "pending_manual_review" / "cursor-mdn-examples"


def scratch_dir() -> Path:
    return art_root() / "pending_manual_review" / "cursor-gen"


def jobs() -> list[CursorJob]:
    return [
        CursorJob(
            "pointer",
            "pointer",
            "pointer",
            (10, 2),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/pointer.gif",
            "CSS pointer cursor: a simple white-gloved pointing hand with a green cuff and tiny gold trim, "
            "Yieldomega arcade-cartoon style. One hand only, index finger clearly indicates a clickable target, "
            "transparent background, thick dark outline, readable at 32px.",
        ),
        CursorJob(
            "context-menu",
            "context-menu",
            "context-menu",
            (6, 5),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/context-menu.png",
            "CSS context-menu cursor: a tiny green-gold arrow pointer with a small stacked menu card beside it. "
            "Extremely simple, readable at 32px, thick dark outline, transparent background, no text.",
        ),
        CursorJob(
            "help",
            "help",
            "help",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/help.gif",
            "CSS help cursor: a small glossy question-mark badge with Yieldomega green and gold arcade styling. "
            "One symbol only, thick outline, transparent background, no other text.",
        ),
        CursorJob(
            "progress",
            "progress",
            "progress",
            (6, 5),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/progress.gif",
            "CSS progress cursor: a small default arrow plus a tiny green-gold progress ring. It must read as "
            "'working but still interactive', extremely simple, transparent background, no text.",
        ),
        CursorJob(
            "text",
            "text",
            "text",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/text.gif",
            "CSS text cursor: a tall I-beam text caret with chunky arcade outline, green stem, small gold caps. "
            "Very narrow, transparent background, no letters.",
        ),
        CursorJob(
            "not-allowed",
            "not-allowed",
            "not-allowed",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/not-allowed.gif",
            "CSS not-allowed cursor: a friendly no-entry badge in Yieldomega green and gold with a red diagonal bar. "
            "Readable at 32px, transparent background, no words.",
        ),
        CursorJob(
            "grabbing",
            "grabbing",
            "grabbing",
            (16, 16),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/grabbing.gif",
            "CSS grabbing cursor: a chunky closed white-gloved hand with green cuff and gold trim, clearly gripping. "
            "Extremely simple and legible at 32px, transparent background.",
        ),
    ]


def _magick(args: list[str]) -> bool:
    for cmd in (["magick"], ["convert"]):
        try:
            subprocess.run(cmd + args, check=True, capture_output=True)
            return True
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    return False


def normalize_cursor(src: Path, dst: Path, *, canvas: int = CURSOR_SIZE) -> None:
    """Trim transparent edges, resize, center on a transparent browser-safe canvas."""
    dst.parent.mkdir(parents=True, exist_ok=True)
    real_dst = dst
    if src.resolve() == dst.resolve():
        real_dst = dst.with_name(f".{dst.stem}.normalized{dst.suffix}")
    if _magick(
        [
            str(src),
            "-background",
            "none",
            "-alpha",
            "on",
            "-trim",
            "+repage",
            "-resize",
            f"{canvas}x{canvas}>",
            "-gravity",
            "center",
            "-extent",
            f"{canvas}x{canvas}",
            "-strip",
            "PNG32:" + str(real_dst),
        ]
    ):
        if real_dst != dst:
            real_dst.replace(dst)
        return
    if Image is None:
        raise RuntimeError("ImageMagick or Pillow is required to normalize cursors")
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()
    if bbox is not None:
        im = im.crop(bbox)
    im.thumbnail((canvas, canvas), Image.Resampling.LANCZOS)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(im, ((canvas - im.width) // 2, (canvas - im.height) // 2))
    out.save(real_dst, format="PNG", optimize=True)
    if real_dst != dst:
        real_dst.replace(dst)


def _save_drawn(slug: str, draw_fn) -> None:
    if Image is None or ImageDraw is None:
        return
    tmp = scratch_dir() / f"{slug}-fallback-raw.png"
    tmp.parent.mkdir(parents=True, exist_ok=True)
    im = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(im)
    draw_fn(draw)
    im.save(tmp, format="PNG")
    normalize_cursor(tmp, cursor_dir() / f"{slug}.png")


def _draw_arrow(draw, *, offset: tuple[int, int] = (0, 0)) -> None:
    ox, oy = offset
    pts = [(10 + ox, 5 + oy), (56 + ox, 48 + oy), (37 + ox, 52 + oy), (48 + ox, 86 + oy), (31 + ox, 91 + oy), (20 + ox, 58 + oy), (5 + ox, 72 + oy)]
    draw.polygon(pts, fill=(12, 45, 23, 255))
    pts2 = [(17 + ox, 18 + oy), (45 + ox, 45 + oy), (29 + ox, 48 + oy), (39 + ox, 78 + oy), (33 + ox, 80 + oy), (23 + ox, 50 + oy), (12 + ox, 60 + oy)]
    draw.polygon(pts2, fill=(255, 222, 42, 255))
    draw.line([(22 + ox, 21 + oy), (39 + ox, 38 + oy)], fill=(255, 255, 196, 255), width=4)


def deliver_fallbacks() -> None:
    cdir = cursor_dir()
    cdir.mkdir(parents=True, exist_ok=True)
    for slug, source_name in FALLBACK_INPUTS.items():
        src = cdir / source_name
        if src.is_file():
            normalize_cursor(src, cdir / f"{slug}.png")

    if (cdir / "grab.png").is_file() and not (cdir / "grabbing.png").is_file():
        normalize_cursor(cdir / "grab.png", cdir / "grabbing.png")
    if (cdir / "wait.png").is_file() and not (cdir / "text.png").is_file():
        normalize_cursor(cdir / "wait.png", cdir / "text.png")

    for legacy in (
        "primary-cta.png",
        "slider-grab.png",
        "text-caret.png",
        "link-pointer.png",
        "danger-pvp.png",
        "external-link.png",
        "cancel.png",
        "copy.png",
        "help.png",
        "loading.png",
        "disabled.png",
        "default-pointer.png",
    ):
        path = cdir / legacy
        if path.is_file():
            normalize_cursor(path, path)

    _save_drawn(
        "context-menu",
        lambda d: (
            _draw_arrow(d),
            d.rounded_rectangle((59, 28, 116, 80), radius=8, fill=(12, 45, 23, 255)),
            d.rounded_rectangle((65, 34, 110, 74), radius=5, fill=(252, 249, 218, 255)),
            d.line((72, 46, 104, 46), fill=(19, 132, 55, 255), width=5),
            d.line((72, 59, 104, 59), fill=(232, 179, 25, 255), width=5),
        ),
    )
    _save_drawn(
        "help",
        lambda d: (
            d.ellipse((18, 18, 110, 110), fill=(12, 45, 23, 255)),
            d.ellipse((27, 27, 101, 101), fill=(255, 222, 42, 255)),
            d.arc((43, 36, 85, 74), 195, 35, fill=(19, 132, 55, 255), width=13),
            d.line((65, 72, 65, 82), fill=(19, 132, 55, 255), width=11),
            d.ellipse((58, 90, 72, 104), fill=(19, 132, 55, 255)),
        ),
    )
    _save_drawn(
        "progress",
        lambda d: (
            _draw_arrow(d),
            d.ellipse((66, 54, 116, 104), fill=(12, 45, 23, 255)),
            d.arc((74, 62, 108, 96), 25, 310, fill=(255, 222, 42, 255), width=9),
            d.polygon([(108, 61), (117, 61), (113, 70)], fill=(255, 222, 42, 255)),
        ),
    )
    _save_drawn(
        "text",
        lambda d: (
            d.rounded_rectangle((52, 10, 76, 118), radius=8, fill=(12, 45, 23, 255)),
            d.rounded_rectangle((58, 19, 70, 109), radius=4, fill=(19, 132, 55, 255)),
            d.rounded_rectangle((39, 10, 89, 26), radius=7, fill=(255, 222, 42, 255), outline=(12, 45, 23, 255), width=5),
            d.rounded_rectangle((39, 102, 89, 118), radius=7, fill=(255, 222, 42, 255), outline=(12, 45, 23, 255), width=5),
        ),
    )
    _save_drawn(
        "not-allowed",
        lambda d: (
            d.ellipse((18, 18, 110, 110), fill=(12, 45, 23, 255)),
            d.ellipse((27, 27, 101, 101), fill=(255, 242, 151, 255)),
            d.line((40, 40, 88, 88), fill=(230, 38, 38, 255), width=20),
            d.line((40, 40, 88, 88), fill=(12, 45, 23, 255), width=5),
        ),
    )


def fetch_examples() -> None:
    example_dir().mkdir(parents=True, exist_ok=True)
    for job in jobs():
        dst = example_dir() / f"{job.slug}{Path(job.mdn_url).suffix}"
        if dst.is_file():
            continue
        with urllib.request.urlopen(job.mdn_url, timeout=30) as response:
            dst.write_bytes(response.read())
        print(f"Fetched {dst.relative_to(ga.REPO_ROOT)}")


def _refs_for_job(job: CursorJob) -> list[Path]:
    refs = [ga.DEFAULT_STYLE_REF, ga.DEFAULT_TOKEN_REF]
    examples = sorted(example_dir().glob(f"{job.slug}.*"))
    refs.extend(examples[:1])
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=job.slug)


def run_replicate_job(job: CursorJob, *, retry_max: int, retry_delay: float, no_refs: bool) -> None:
    import replicate

    prompt = ga.augment_prompt_chroma_backdrop(
        ga.build_prompt(
            "UI cursor sprite only. Use the supplied unstyled cursor example only for the affordance/silhouette, "
            "not for style. Convert it into a transparent Yieldomega cursor.\n\n"
            f"CSS cursor role: {job.css_name}\n"
            f"Hotspot target after resize: {job.hotspot}\n"
            f"Subject: {job.subject}\n"
            "Hard requirements: one cursor only, transparent background, no shadow blob, no scene, no UI panel, no "
            "words, no watermark, very simple and legible at 32px."
        )
    )
    inp: dict = {
        "prompt": prompt,
        "aspect_ratio": "1:1",
        "quality": "high",
        "background": ga.api_background_for_replicate("transparent"),
        "moderation": "low",
        "output_format": "png",
        "number_of_images": 1,
        "output_compression": 90,
        "input_images": [],
    }
    client = (
        replicate.Client(timeout=httpx.Timeout(120.0, connect=60.0, write=600.0, read=900.0, pool=300.0))
        if httpx is not None
        else replicate.Client()
    )

    def call_model() -> object:
        if no_refs:
            return _bounded.run_model_bounded(client, ga.MODEL, inp, prefer_wait=1, job_label=job.slug)
        refs = _refs_for_job(job)
        missing = [p for p in refs if not p.is_file()]
        if missing:
            raise FileNotFoundError("Missing cursor refs:\n  " + "\n  ".join(str(p) for p in missing))
        handles = [open(p, "rb") for p in refs]
        try:
            inp["input_images"] = handles
            return _bounded.run_model_bounded(client, ga.MODEL, inp, prefer_wait=1, job_label=job.slug)
        finally:
            for handle in handles:
                handle.close()

    output = ga.run_with_retries(call_model, max_attempts=retry_max, base_delay_sec=retry_delay, job_label=job.slug)
    raw = ga.postprocess_chroma_to_transparent(ga._read_output_bytes(output))
    scratch = scratch_dir() / f"{job.slug}-raw.png"
    scratch.parent.mkdir(parents=True, exist_ok=True)
    scratch.write_bytes(raw)
    normalize_cursor(scratch, cursor_dir() / job.filename)
    print(f"Promoted cursors/{job.filename}")


def write_prompts_json() -> None:
    manifest = SCRIPT_DIR / "cursors" / "prompts.json"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "model": ga.MODEL,
        "output": "frontend/public/art/cursors",
        "size": f"{CURSOR_SIZE}x{CURSOR_SIZE}",
        "jobs": [
            {
                "filename": job.filename,
                "css_name": job.css_name,
                "fallback": job.fallback,
                "hotspot": job.hotspot,
                "mdn_example": job.mdn_url,
                "subject": job.subject,
            }
            for job in jobs()
        ],
    }
    manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest.relative_to(ga.REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Yieldomega cursor pack")
    parser.add_argument("--derivatives-only", action="store_true")
    parser.add_argument("--generate-only", action="store_true")
    parser.add_argument("--fetch-examples", action="store_true")
    parser.add_argument("--write-prompts-json", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--start-from", type=int, default=0, help="0-based job index to start from")
    parser.add_argument("--max-jobs", type=int, default=0, help="Stop after N generated jobs (0 = no limit)")
    parser.add_argument("--sleep", type=float, default=22.0)
    parser.add_argument("--no-ref-images", action="store_true")
    args = parser.parse_args()

    if args.write_prompts_json:
        write_prompts_json()
        return 0
    if args.fetch_examples:
        fetch_examples()
        if args.derivatives_only:
            return 0

    ga.load_env()
    if not args.generate_only:
        deliver_fallbacks()
    if args.derivatives_only:
        return 0

    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print("REPLICATE_API_TOKEN unset - kept local normalized cursor fallbacks.", file=sys.stderr)
        return 0
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    finished = 0
    for idx, job in enumerate(jobs()):
        if idx < args.start_from:
            continue
        final = cursor_dir() / job.filename
        if args.skip_existing and final.is_file():
            print(f"Skip existing {final.name}")
            continue
        print(f"[{idx + 1}/{len(jobs())}] {job.slug}")
        if not args.dry_run:
            run_replicate_job(job, retry_max=8, retry_delay=20.0, no_refs=args.no_ref_images)
            finished += 1
            if args.max_jobs and finished >= args.max_jobs:
                print(f"--max-jobs {args.max_jobs} reached; stopping.")
                break
        if idx < len(jobs()) - 1 and args.sleep > 0:
            time.sleep(args.sleep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

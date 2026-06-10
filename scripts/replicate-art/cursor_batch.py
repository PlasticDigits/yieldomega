#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate and normalize the frontend cursor pack.

Cursors follow the **cyberminimalist neon** direction (#290): simple luminous icon
silhouettes, high-definition source renders, transparent 22px PNG delivery.

The Replicate path creates fresh icons from text-only briefs by default. When
REPLICATE_API_TOKEN is unavailable, ``--derivatives-only`` still emits small local
neon fallbacks.

Run from repo root or scripts/replicate-art::

  python3 scripts/replicate-art/cursor_batch.py --derivatives-only
  python3 scripts/replicate-art/cursor_batch.py --fetch-examples
  python3 scripts/replicate-art/cursor_batch.py --generate-only
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
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


CURSOR_SIZE = 22
PARALLEL_WORKERS = 10
RETRY_MAX = 1
RELOAD_RETRIES = 0

# Cyberminimalist neon palette (--yga-* / --yo-* in index.css)
_NEON_NAVY = (7, 18, 31, 255)
_NEON_FILL = (12, 28, 48, 220)
_NEON_CYAN = (126, 241, 255, 255)
_NEON_TEAL = (45, 212, 168, 255)
_NEON_DANGER = (255, 107, 122, 255)

CURSOR_NEGATIVE = """
no old cursor pack style, no stock operating-system cursor, no glassmorphism, no bevel,
no gold accents, no bulky shadow, no glow blob, no photorealism, no 3D shading,
no texture, no character, no words, no watermark, no complex detail, no scene,
no background art, no pixelated edges, no low-resolution jaggies
""".strip()

NEON_CURSOR_STYLE = """
Fresh Yield Omega UI cursor icon.
Render a high-definition source icon at native model resolution, centered and isolated for
later local downscaling to 22x22. Make the silhouette extremely simple and legible: one
neon cursor affordance, crisp vector-like geometry, 1-2 luminous stroke colors
(electric cyan, teal, or coral) over a very dark navy interior fill. Use clean negative
space, no interior decoration, and edges that will stay sharp after downscaling.
""".strip()


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
            "default",
            "default",
            "auto",
            (3, 3),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/default.gif",
            "Default arrow cursor: sharp top-left arrow tip, hollow dark navy fill, electric cyan rim.",
        ),
        CursorJob(
            "pointer",
            "pointer",
            "pointer",
            (7, 1),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/pointer.gif",
            "Pointer hand cursor: simplified raised index-finger silhouette, cyan rim, no finger detail.",
        ),
        CursorJob(
            "grab",
            "grab",
            "grab",
            (11, 11),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/grab.gif",
            "Grab cursor: standard open hand cursor silhouette, palm and fingers readable, teal neon rim, dark navy fill.",
        ),
        CursorJob(
            "grabbing",
            "grabbing",
            "grabbing",
            (11, 11),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/grabbing.gif",
            "Grabbing cursor: standard closed fist hand cursor silhouette, clenched fingers readable, teal neon rim, dark navy fill.",
        ),
        CursorJob(
            "wait",
            "wait",
            "wait",
            (11, 11),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/wait.gif",
            "Wait cursor: tiny hourglass or spinner ring, single cyan outline, no sand detail.",
        ),
        CursorJob(
            "context-menu",
            "context-menu",
            "context-menu",
            (4, 4),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/context-menu.png",
            "Context-menu cursor: small arrow plus one tiny menu tile, minimal cyan/teal lines.",
        ),
        CursorJob(
            "help",
            "help",
            "help",
            (11, 11),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/help.gif",
            "Help cursor: compact question-mark symbol in a ring, cyan neon outline, readable at 22px.",
        ),
        CursorJob(
            "progress",
            "progress",
            "progress",
            (4, 4),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/progress.gif",
            "Progress cursor: arrow plus tiny partial activity ring, cyan arrow and teal ring.",
        ),
        CursorJob(
            "text",
            "text",
            "text",
            (11, 11),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/text.gif",
            "Text cursor: thin I-beam with small caps, electric cyan stroke, dark navy core.",
        ),
        CursorJob(
            "not-allowed",
            "not-allowed",
            "not-allowed",
            (11, 11),
            "https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/cursor/not-allowed.gif",
            "Not-allowed cursor: circle with diagonal slash, cyan ring and coral slash.",
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


def _draw_neon_arrow(draw: ImageDraw.ImageDraw, *, offset: tuple[int, int] = (0, 0)) -> None:
    ox, oy = offset
    pts = [
        (12 + ox, 8 + oy),
        (50 + ox, 44 + oy),
        (36 + ox, 48 + oy),
        (44 + ox, 80 + oy),
        (30 + ox, 84 + oy),
        (22 + ox, 52 + oy),
        (8 + ox, 64 + oy),
    ]
    draw.polygon(pts, outline=_NEON_CYAN, fill=_NEON_FILL, width=3)


def _draw_neon_pointer(draw: ImageDraw.ImageDraw) -> None:
    draw.polygon(
        [(22, 90), (36, 28), (46, 26), (50, 56), (62, 22), (74, 24), (68, 60), (80, 64), (54, 94)],
        outline=_NEON_CYAN,
        fill=_NEON_FILL,
        width=3,
    )


def _draw_neon_grab(draw: ImageDraw.ImageDraw, *, closed: bool = False) -> None:
    if closed:
        pts = [
            (30, 54),
            (38, 36),
            (48, 34),
            (52, 46),
            (58, 32),
            (68, 32),
            (70, 48),
            (78, 38),
            (88, 42),
            (84, 60),
            (96, 64),
            (90, 88),
            (74, 102),
            (48, 98),
            (34, 82),
        ]
    else:
        pts = [
            (30, 94),
            (34, 46),
            (44, 42),
            (48, 72),
            (52, 32),
            (62, 30),
            (64, 70),
            (70, 34),
            (80, 36),
            (78, 72),
            (86, 48),
            (96, 52),
            (88, 92),
            (68, 106),
            (46, 104),
        ]
    draw.polygon(pts, outline=_NEON_TEAL, fill=_NEON_FILL, width=4)
    if closed:
        draw.line((42, 60, 82, 64), fill=_NEON_CYAN, width=3)
    else:
        draw.line((44, 46, 46, 80), fill=_NEON_CYAN, width=3)
        draw.line((62, 34, 62, 78), fill=_NEON_CYAN, width=3)
        draw.line((78, 40, 76, 78), fill=_NEON_CYAN, width=3)


def deliver_fallbacks() -> None:
    """Emit programmatic cyberminimalist neon cursor fallbacks for every canonical slug."""
    cursor_dir().mkdir(parents=True, exist_ok=True)

    _save_drawn("default", lambda d: _draw_neon_arrow(d))
    _save_drawn("pointer", _draw_neon_pointer)
    _save_drawn("grab", lambda d: _draw_neon_grab(d, closed=False))
    _save_drawn("grabbing", lambda d: _draw_neon_grab(d, closed=True))
    _save_drawn(
        "wait",
        lambda d: (
            d.polygon([(64, 20), (84, 54), (64, 88), (44, 54)], outline=_NEON_CYAN, fill=_NEON_FILL, width=3),
            d.line((64, 32, 64, 76), fill=_NEON_CYAN, width=3),
        ),
    )
    _save_drawn(
        "context-menu",
        lambda d: (
            _draw_neon_arrow(d),
            d.rectangle((62, 32, 108, 72), outline=_NEON_CYAN, fill=_NEON_FILL, width=3),
        ),
    )
    _save_drawn(
        "help",
        lambda d: (
            d.ellipse((24, 24, 104, 104), outline=_NEON_CYAN, fill=_NEON_FILL, width=3),
            d.arc((44, 38, 84, 72), 200, 340, fill=_NEON_CYAN, width=6),
            d.line((64, 74, 64, 82), fill=_NEON_CYAN, width=5),
            d.ellipse((58, 88, 70, 100), fill=_NEON_CYAN),
        ),
    )
    _save_drawn(
        "progress",
        lambda d: (
            _draw_neon_arrow(d),
            d.arc((70, 58, 110, 98), 30, 300, fill=_NEON_TEAL, width=4),
        ),
    )
    _save_drawn(
        "text",
        lambda d: (
            d.rectangle((56, 14, 72, 114), outline=_NEON_CYAN, fill=_NEON_FILL, width=3),
            d.line((42, 14, 86, 14), fill=_NEON_CYAN, width=4),
            d.line((42, 114, 86, 114), fill=_NEON_CYAN, width=4),
        ),
    )
    _save_drawn(
        "not-allowed",
        lambda d: (
            d.ellipse((24, 24, 104, 104), outline=_NEON_CYAN, fill=_NEON_FILL, width=3),
            d.line((44, 44, 84, 84), fill=_NEON_DANGER, width=6),
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
    """MDN silhouette example only — no heavy style refs that add complexity."""
    examples = sorted(example_dir().glob(f"{job.slug}.*"))
    refs = examples[:1]
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=job.slug)


def _build_neon_cursor_prompt(job: CursorJob) -> str:
    return ga.augment_prompt_chroma_backdrop(
        f"{NEON_CURSOR_STYLE}\n\n"
        "Create this cursor icon from scratch. Do not reuse previous Yield Omega cursor prompts, "
        "do not imitate the old SVGs, and do not copy any browser or OS cursor artwork.\n\n"
        f"CSS cursor role: {job.css_name}\n"
        f"Hotspot target after resize: {job.hotspot}\n"
        f"Subject: {job.subject}\n\n"
        "Hard requirements: high-definition source image, one cursor icon only, centered with generous "
        "padding, max 2 neon colors plus dark navy fill, no interior detail, no shadow, no scene, "
        "no words, no watermark, must remain simple and legible after local 22px downscale.\n\n"
        f"Strictly avoid:\n{CURSOR_NEGATIVE}"
    )


def run_replicate_job(
    job: CursorJob,
    *,
    retry_max: int,
    retry_delay: float,
    no_refs: bool,
    reload_retries: int,
) -> None:
    import replicate

    prompt = _build_neon_cursor_prompt(job)
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
        bounded_kw = dict(
            prefer_wait=1,
            job_label=job.slug,
            reload_retries=reload_retries,
        )
        if no_refs:
            return _bounded.run_model_bounded(client, ga.MODEL, inp, **bounded_kw)
        refs = _refs_for_job(job)
        missing = [p for p in refs if not p.is_file()]
        if missing:
            raise FileNotFoundError("Missing cursor refs:\n  " + "\n  ".join(str(p) for p in missing))
        handles = [open(p, "rb") for p in refs]
        try:
            inp["input_images"] = handles
            return _bounded.run_model_bounded(client, ga.MODEL, inp, **bounded_kw)
        finally:
            for handle in handles:
                handle.close()

    output = ga.run_with_retries(
        call_model, max_attempts=retry_max, base_delay_sec=retry_delay, job_label=job.slug
    )
    raw = ga.postprocess_chroma_to_transparent(ga._read_output_bytes(output))
    scratch = scratch_dir() / f"{job.slug}-raw.png"
    scratch.parent.mkdir(parents=True, exist_ok=True)
    scratch.write_bytes(raw)
    normalize_cursor(scratch, cursor_dir() / job.filename)
    print(f"Promoted cursors/{job.filename}")


def _run_job_wrapper(
    idx: int,
    job: CursorJob,
    *,
    dry_run: bool,
    skip_existing: bool,
    no_refs: bool,
) -> tuple[str, str | None]:
    """Returns (slug, error_message_or_None)."""
    final = cursor_dir() / job.filename
    if skip_existing and final.is_file():
        print(f"Skip existing {final.name}")
        return job.slug, None
    print(f"[{idx + 1}/{len(jobs())}] {job.slug}")
    if dry_run:
        return job.slug, None
    try:
        run_replicate_job(
            job,
            retry_max=RETRY_MAX,
            retry_delay=0.0,
            no_refs=no_refs,
            reload_retries=RELOAD_RETRIES,
        )
        return job.slug, None
    except Exception as exc:
        print(f"[{job.slug}] FAILED: {exc}", file=sys.stderr)
        return job.slug, str(exc)


def write_prompts_json() -> None:
    manifest = SCRIPT_DIR / "cursors" / "prompts.json"
    manifest.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "model": ga.MODEL,
        "style": "cyberminimalist-neon",
        "source": "text-only fresh HD prompts; no reference images required",
        "output": "frontend/public/art/cursors",
        "size": f"{CURSOR_SIZE}x{CURSOR_SIZE}",
        "parallel_workers": PARALLEL_WORKERS,
        "retry_max": RETRY_MAX,
        "reload_retries": RELOAD_RETRIES,
        "jobs": [
            {
                "filename": job.filename,
                "css_name": job.css_name,
                "fallback": job.fallback,
                "hotspot": job.hotspot,
                "subject": job.subject,
            }
            for job in jobs()
        ],
    }
    manifest.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {manifest.relative_to(ga.REPO_ROOT)}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Yieldomega cyberminimalist neon cursor pack")
    parser.add_argument("--derivatives-only", action="store_true")
    parser.add_argument("--generate-only", action="store_true")
    parser.add_argument("--fetch-examples", action="store_true")
    parser.add_argument("--write-prompts-json", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--start-from", type=int, default=0, help="0-based job index to start from")
    parser.add_argument("--max-jobs", type=int, default=0, help="Stop after N generated jobs (0 = no limit)")
    parser.add_argument("--workers", type=int, default=PARALLEL_WORKERS)
    parser.add_argument(
        "--with-ref-images",
        action="store_true",
        help="Opt in to MDN affordance references; default is fresh text-only prompts.",
    )
    parser.add_argument(
        "--no-ref-images",
        action="store_true",
        help="Deprecated no-op kept for old command lines; text-only is now the default.",
    )
    args = parser.parse_args()

    if args.write_prompts_json:
        write_prompts_json()
        return 0
    if args.fetch_examples:
        fetch_examples()
        return 0

    ga.load_env()
    if not args.generate_only:
        deliver_fallbacks()
    if args.derivatives_only:
        return 0

    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print("REPLICATE_API_TOKEN unset - kept local neon cursor fallbacks.", file=sys.stderr)
        return 0
    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    job_list = list(enumerate(jobs()))
    if args.start_from:
        job_list = [(i, j) for i, j in job_list if i >= args.start_from]
    if args.max_jobs:
        job_list = job_list[: args.max_jobs]

    failures: list[tuple[str, str]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(
                _run_job_wrapper,
                idx,
                job,
                dry_run=args.dry_run,
                skip_existing=args.skip_existing,
                no_refs=not args.with_ref_images,
            ): job
            for idx, job in job_list
        }
        for fut in as_completed(futures):
            slug, err = fut.result()
            if err:
                failures.append((slug, err))

    if failures:
        print(f"\n{len(failures)} cursor(s) failed:", file=sys.stderr)
        for slug, err in failures:
            print(f"  {slug}: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

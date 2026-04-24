#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""GitLab issue #60 — extend cursor pack (link, loading, cancel, copy, optional help).

Delivers **production** PNGs under ``frontend/public/art/cursors/`` using Pillow
resizes from existing issue #45 / #57 art, then optional Replicate refresh when
``REPLICATE_API_TOKEN`` is set (same stack as ``issue45_batch.py`` / ``issue57_batch.py``).

Run::

  cd scripts/replicate-art && .venv/bin/python issue60_batch.py --derivatives-only
  .venv/bin/python issue60_batch.py   # + Replicate when token present
"""

from __future__ import annotations

import argparse
import io
import json
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

try:
    from PIL import Image
except ImportError:
    Image = None  # type: ignore[misc, assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import generate_assets as ga  # noqa: E402
import flagged_inputs as _flagged_inputs  # noqa: E402
import replicate_bounded_run as _bounded  # noqa: E402

ResizeMode = Literal["portrait_768_1024", "cutout", "icon_256", "none"]
PostDeliver = Literal["none", "cursor_24_center"]


@dataclass(frozen=True)
class BatchJob:
    filename: str
    checklist_item: str
    aspect_ratio: str
    background: str
    output_format: str
    resize: ResizeMode
    subject: str
    deliver_relative: str
    post_deliver: PostDeliver


def _art() -> Path:
    return ga.REPO_ROOT / "frontend" / "public" / "art"


def _refs_for_slug(slug: str) -> list[Path]:
    refs = [ga.DEFAULT_STYLE_REF, ga.DEFAULT_TOKEN_REF]
    return _flagged_inputs.filter_reference_paths(refs, ga.REPO_ROOT, job_label=slug)


def _read_output_bytes(output: object) -> bytes:
    return ga._read_output_bytes(output)


def _fit_inside(im: Image.Image, max_w: int, max_h: int) -> Image.Image:
    w, h = im.size
    scale = min(max_w / w, max_h / h, 1.0)
    if scale >= 1.0:
        return im
    return im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)


def _scale_max_long_edge(im: Image.Image, max_edge: int) -> Image.Image:
    w, h = im.size
    long_edge = max(w, h)
    if long_edge <= max_edge:
        return im
    s = max_edge / long_edge
    nw, nh = max(1, int(w * s)), max(1, int(h * s))
    return im.resize((nw, nh), Image.Resampling.LANCZOS)


def _resize_bytes(data: bytes, resize: ResizeMode, output_format: str) -> bytes:
    if resize == "none" or Image is None:
        return data
    im = Image.open(io.BytesIO(data))
    if output_format == "png" and resize in ("cutout", "icon_256"):
        im = im.convert("RGBA")
    if resize == "portrait_768_1024":
        im = _scale_max_long_edge(im, 1024)
        im = _fit_inside(im, 768, 1024)
    elif resize == "cutout":
        im = _scale_max_long_edge(im, 1024)
    elif resize == "icon_256":
        im = _fit_inside(im, 256, 256)
    else:
        raise ValueError(resize)
    buf = io.BytesIO()
    if output_format == "png":
        im.save(buf, format="PNG", optimize=True)
    else:
        im.convert("RGB").save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue()


def _post_cursor(data: bytes, post: PostDeliver) -> bytes:
    if post == "none" or Image is None:
        return data
    if post == "cursor_24_center":
        im = Image.open(io.BytesIO(data)).convert("RGBA")
        im = _fit_inside(im, 24, 24)
        buf = io.BytesIO()
        im.save(buf, format="PNG", optimize=True)
        return buf.getvalue()
    raise ValueError(post)


def deliver_derivatives() -> None:
    """Pillow-only crops from in-repo art (no network)."""
    if Image is None:
        print("Pillow required: pip install Pillow", file=sys.stderr)
        return
    art = _art()

    def save_fit(src_rel: str, dst_rel: str, w: int, h: int) -> None:
        src = art / src_rel
        dst = art / dst_rel
        if not src.is_file():
            print(f"skip {dst_rel}: missing {src_rel}", file=sys.stderr)
            return
        im = Image.open(src).convert("RGBA")
        im = _fit_inside(im, w, h)
        dst.parent.mkdir(parents=True, exist_ok=True)
        im.save(dst, format="PNG", optimize=True)
        print(f"wrote {dst_rel} ({w}×{h}) ← {src_rel}")

    # Quieter than primary-cta: small nav pictogram / chart glyph reads as “link”.
    save_fit("icons/nav-protocol.png", "cursors/link-pointer.png", 24, 24)
    save_fit("icons/loading-mascot-ring.png", "cursors/loading.png", 24, 24)
    save_fit("icons/status-ended.png", "cursors/cancel.png", 24, 24)
    save_fit("icons/chart-accessibility.png", "cursors/copy.png", 24, 24)
    save_fit("icons/status-net-ok.png", "cursors/help.png", 24, 24)


def run_batch_job(job: BatchJob, *, scratch_dir: Path, retry_max: int, retry_delay: float, no_refs: bool) -> None:
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

    output = ga.run_with_retries(call_model, max_attempts=retry_max, base_delay_sec=retry_delay, job_label=stem)
    if not output:
        raise RuntimeError(f"no output for {stem}")
    raw = _read_output_bytes(output)
    if catalog_bg == "transparent":
        raw = ga.postprocess_chroma_to_transparent(raw)
    if Image is not None and job.resize != "none":
        raw = _resize_bytes(raw, job.resize, "png" if out_fmt == "png" else "jpeg")
    scratch_dir.mkdir(parents=True, exist_ok=True)
    scratch_path.write_bytes(raw)
    final = _art() / job.deliver_relative
    final.parent.mkdir(parents=True, exist_ok=True)
    out = _post_cursor(raw, job.post_deliver) if out_fmt == "png" else raw
    final.write_bytes(out)
    print(f"promoted {job.deliver_relative} ({len(out)} b)")


def jobs() -> list[BatchJob]:
    return [
        BatchJob(
            "issue60-cursor-link-pointer.png",
            "link pointer (quieter than CTA)",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor only: a small soft-green **arrow + subtle underline** motif, thick black outline, arcade toy "
            "finish—clearly a link pointer, **not** the loud gold primary-CTA hand, no characters, no text, transparent.",
            "cursors/link-pointer.png",
            "cursor_24_center",
        ),
        BatchJob(
            "issue60-cursor-loading.png",
            "loading / busy",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor only: a tiny **hourglass or progress ring** in green and gold, chunky outlines—implies waiting, "
            "no characters, no digits, transparent background, readable at 24px.",
            "cursors/loading.png",
            "cursor_24_center",
        ),
        BatchJob(
            "issue60-cursor-cancel.png",
            "cancel / dismiss",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor only: a **round back-out / dismiss** badge with a bold X or curved return arrow, thick outlines, "
            "friendly arcade style—distinct from a disabled shield, no text, transparent, 24px readable.",
            "cursors/cancel.png",
            "cursor_24_center",
        ),
        BatchJob(
            "issue60-cursor-copy.png",
            "copy to clipboard",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor only: **two stacked document sheets** with a tiny corner fold—classic copy affordance, chunky "
            "arcade outlines, green/gold, no letters, transparent, 24px.",
            "cursors/copy.png",
            "cursor_24_center",
        ),
        BatchJob(
            "issue60-cursor-help.png",
            "help / hints (optional)",
            "1:1",
            "transparent",
            "png",
            "icon_256",
            "UI cursor only: a small **question mark** inside a glossy coin-badge frame matching token-logo buckle "
            "language, thick outline, transparent, 24px, no other text.",
            "cursors/help.png",
            "cursor_24_center",
        ),
    ]


def write_prompts_json() -> None:
    m = SCRIPT_DIR / "issue60" / "prompts.json"
    m.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "issue": 60,
        "issue_url": "https://gitlab.com/PlasticDigits/yieldomega/-/issues/60",
        "model": ga.MODEL,
        "jobs": [
            {
                "filename": j.filename,
                "deliver_to": f"frontend/public/art/{j.deliver_relative}",
                "subject": j.subject,
            }
            for j in jobs()
        ],
    }
    m.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {m}")


def main() -> int:
    p = argparse.ArgumentParser(description="Issue #60 cursor pack")
    p.add_argument("--derivatives-only", action="store_true")
    p.add_argument("--generate-only", action="store_true")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--skip-existing", action="store_true")
    p.add_argument("--sleep", type=float, default=22.0)
    p.add_argument("--no-ref-images", action="store_true")
    p.add_argument("--write-prompts-json", action="store_true")
    args = p.parse_args()

    ga.load_env()
    if args.write_prompts_json:
        write_prompts_json()
        return 0

    if not args.generate_only:
        deliver_derivatives()

    if args.derivatives_only:
        return 0

    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not args.dry_run and not token:
        print("REPLICATE_API_TOKEN unset — skipping Replicate refresh (Pillow derivatives kept).", file=sys.stderr)
        return 0

    if not args.dry_run:
        os.environ["REPLICATE_API_TOKEN"] = token

    scratch = ga.REPO_ROOT / "frontend" / "public" / "art" / "pending_manual_review" / "issue60-gen"
    scratch.mkdir(parents=True, exist_ok=True)

    for idx, job in enumerate(jobs()):
        final = _art() / job.deliver_relative
        if args.skip_existing and final.is_file():
            print(f"skip {final.name}")
            continue
        print(f"[{idx + 1}/{len(jobs())}] {job.filename}")
        if args.dry_run:
            continue
        run_batch_job(job, scratch_dir=scratch, retry_max=8, retry_delay=20.0, no_refs=args.no_ref_images)
        if idx < len(jobs()) - 1 and args.sleep > 0:
            time.sleep(args.sleep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

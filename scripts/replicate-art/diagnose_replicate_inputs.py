#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Isolate which local files trigger Replicate moderation / NSFW pipeline noise for gpt-image-2.

When logs show ``NSFW check failed for image 0`` (and ``image 1``), those indices
match ``input_images`` order. This script runs **small** predictions (``quality=low``,
``1:1``, ``jpeg``) with different subsets of your usual references so you can see
which combination fails or which single file is blamed.

Run from a clone that has ``scripts/replicate-art/.venv`` (or install ``replicate``,
``python-dotenv``, ``Pillow``):

  cd scripts/replicate-art
  . .venv/bin/activate
  python diagnose_replicate_inputs.py
  python diagnose_replicate_inputs.py --combos
  python diagnose_replicate_inputs.py --jpeg-probes

``--jpeg-probes`` re-encodes each PNG reference to a temporary RGB JPEG and re-runs
the single-file test. If JPEG passes but PNG fails, the issue is likely **alpha /
channel layout** in the PNG, not content.

Use ``--moderation auto`` to compare behavior against ``low``.
"""

from __future__ import annotations

import argparse
import io
import os
import sys
import tempfile
import time
from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

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
import replicate_bounded_run as bounded  # noqa: E402

MODEL_OWNER, MODEL_NAME = ga.MODEL.split("/", 1)


def _client():
    import replicate

    if httpx is None:
        return replicate.Client()
    return replicate.Client(
        timeout=httpx.Timeout(
            120.0,
            connect=60.0,
            write=600.0,
            read=900.0,
            pool=300.0,
        )
    )


def _log_tail(logs: str | None, n: int = 40) -> str:
    if not logs:
        return "(no logs)"
    lines = logs.strip().splitlines()
    if len(lines) <= n:
        return logs.strip()
    return "\n".join(lines[-n:])


@contextmanager
def _open_inputs(paths: list[Path]) -> Iterator[list]:
    handles: list[object] = []
    try:
        for p in paths:
            handles.append(open(p, "rb"))
        yield handles
    finally:
        for h in handles:
            h.close()


def _png_to_temp_jpeg(png_path: Path) -> Path:
    if Image is None:
        raise RuntimeError("Pillow required for --jpeg-probes")
    im = Image.open(png_path).convert("RGB")
    fd, name = tempfile.mkstemp(suffix=".jpg", prefix="replicate-probe-")
    os.close(fd)
    out = Path(name)
    im.save(out, format="JPEG", quality=92)
    return out


def run_case(
    client,
    *,
    label: str,
    paths: list[Path],
    moderation: str,
    prefer_wait: int = 1,
) -> int:
    missing = [p for p in paths if not p.is_file()]
    if missing:
        print(f"[skip] {label} — missing:\n  " + "\n  ".join(str(p) for p in missing), file=sys.stderr)
        return 2

    inp = {
        "prompt": "Minimal test image: single flat green rounded square on white, no characters, no text.",
        "aspect_ratio": "1:1",
        "quality": "low",
        "background": "opaque",
        "moderation": moderation,
        "output_format": "jpeg",
        "number_of_images": 1,
        "output_compression": 85,
        "input_images": [],
    }

    print(f"\n=== {label} ===", file=sys.stderr)
    print("input_images:", " , ".join(str(p) for p in paths) if paths else "(none)", file=sys.stderr)

    with _open_inputs(paths) as handles:
        inp["input_images"] = handles
        pred = client.models.predictions.create(
            model=(MODEL_OWNER, MODEL_NAME),
            input=inp,
            wait=prefer_wait,
        )
    bounded.wait_prediction_bounded(
        pred,
        client,
        max_seconds=bounded.max_generation_seconds(),
        job_label=label,
    )

    print(f"id: {pred.id}", file=sys.stderr)
    print(f"status: {pred.status}", file=sys.stderr)
    if pred.error:
        print(f"error: {pred.error}", file=sys.stderr)
    print("--- logs (tail) ---", file=sys.stderr)
    print(_log_tail(pred.logs), file=sys.stderr)
    print("---", file=sys.stderr)

    if pred.status == "succeeded":
        return 0
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Diagnose gpt-image-2 input_images moderation behavior")
    parser.add_argument("--combos", action="store_true", help="Include pair tests (style+token, style+sir, …)")
    parser.add_argument(
        "--jpeg-probes",
        action="store_true",
        help="After each single-PNG test, repeat with a temp RGB JPEG copy (channel-format hypothesis)",
    )
    parser.add_argument("--moderation", choices=("auto", "low"), default="low")
    parser.add_argument("--sleep", type=float, default=12.0, help="Seconds between API calls")
    args = parser.parse_args()

    ga.load_env()
    token = os.environ.get("REPLICATE_API_TOKEN", "").strip()
    if not token:
        print("REPLICATE_API_TOKEN is not set", file=sys.stderr)
        return 1
    os.environ["REPLICATE_API_TOKEN"] = token

    style = ga.DEFAULT_STYLE_REF
    token_ref = ga.DEFAULT_TOKEN_REF
    sir = ga.DEFAULT_SIR_CARD_REF

    scenarios: list[tuple[str, list[Path]]] = [
        ("no input_images", []),
        ("style.png only", [style]),
        ("token-logo.png only", [token_ref]),
    ]
    if sir.is_file():
        scenarios.append(("sir.png only", [sir]))

    if args.combos:
        scenarios.append(("style + token", [style, token_ref]))
        if sir.is_file():
            scenarios.extend(
                [
                    ("style + sir", [style, sir]),
                    ("token + sir", [token_ref, sir]),
                    ("style + token + sir", [style, token_ref, sir]),
                ]
            )

    client = _client()
    rc = 0
    temps: list[Path] = []

    try:
        for label, paths in scenarios:
            r = run_case(client, label=label, paths=paths, moderation=args.moderation)
            rc = max(rc, r)
            if args.jpeg_probes and len(paths) == 1 and paths[0].suffix.lower() == ".png":
                try:
                    jp = _png_to_temp_jpeg(paths[0])
                    temps.append(jp)
                    r2 = run_case(
                        client,
                        label=f"{label} (RGB JPEG re-encode)",
                        paths=[jp],
                        moderation=args.moderation,
                    )
                    rc = max(rc, r2)
                except Exception as e:
                    print(f"[jpeg-probe error] {e}", file=sys.stderr)
                    rc = 1
            if args.sleep > 0:
                time.sleep(args.sleep)
    finally:
        for tpath in temps:
            tpath.unlink(missing_ok=True)

    print("\nDone. Map 'image 0' / 'image 1' in Replicate logs to the order printed above.", file=sys.stderr)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())

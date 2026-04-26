#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Trim the first N seconds of audio with ffmpeg (fixes many AI lead-in clicks / 'nail' squeaks).

Model glitches and MP3 priming often sit in the first ~100–250 ms; harsh HF garbage sometimes
needs a slightly longer skip. Re-encodes to MP3 for clean frame alignment.

  pip install none   # uses system ffmpeg only

  python trim_lead_in.py output/album_part_1/*.mp3
  python trim_lead_in.py --dir output/album_part_1 --skip 0.18
  python trim_lead_in.py one.mp3 --skip 0.12 --suffix _leadtrim
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> None:
    if not shutil.which("ffmpeg"):
        print("ffmpeg not found on PATH; install ffmpeg (e.g. apt install ffmpeg).", file=sys.stderr)
        sys.exit(2)

    p = argparse.ArgumentParser(description="Trim start of audio files with ffmpeg.")
    p.add_argument(
        "files",
        nargs="*",
        type=Path,
        help="Input audio files (e.g. *.mp3)",
    )
    p.add_argument(
        "--dir",
        type=Path,
        default=None,
        help="Also process every .mp3 in this directory (non-recursive).",
    )
    p.add_argument(
        "--skip",
        type=float,
        default=0.15,
        help="Seconds to remove from the start (default: 0.15). Try 0.08–0.25.",
    )
    p.add_argument(
        "--suffix",
        type=str,
        default="_leadtrim",
        help="Output basename suffix before extension (default: _leadtrim). "
        "Written beside the input as name{suffix}.mp3",
    )
    p.add_argument(
        "--bitrate",
        type=str,
        default="128k",
        help="libmp3lame bitrate (default: 128k).",
    )
    args = p.parse_args()

    paths: list[Path] = list(args.files)
    if args.dir is not None:
        d = args.dir.resolve()
        if d.is_dir():
            paths.extend(sorted(d.glob("*.mp3")))

    paths = [p.resolve() for p in paths if p.is_file()]
    if not paths:
        print("No input files; pass paths or --dir with .mp3 files.", file=sys.stderr)
        sys.exit(2)

    skip = max(0.0, args.skip)
    for inp in paths:
        if inp.suffix.lower() != ".mp3":
            print(f"[skip] not .mp3: {inp}", file=sys.stderr)
            continue
        out = inp.with_name(f"{inp.stem}{args.suffix}.mp3")
        cmd = [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-i",
            str(inp),
            "-ss",
            f"{skip:.4f}",
            "-acodec",
            "libmp3lame",
            "-b:a",
            args.bitrate,
            str(out),
        ]
        print(f"[trim] {inp.name} -> {out.name} (skip {skip}s)", file=sys.stderr)
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0:
            print(r.stderr or r.stdout or "ffmpeg failed", file=sys.stderr)
            sys.exit(1)
        print(f"[ok] {out}")


if __name__ == "__main__":
    main()

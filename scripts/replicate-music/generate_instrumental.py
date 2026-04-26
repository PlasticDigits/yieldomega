#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Generate instrumental music via Replicate (minimax/music-2.6).

This script is **instrumental-only**: it always sets ``is_instrumental: true`` and never
sends ``lyrics``. See README.md for full model parameter documentation.

  cd scripts/replicate-music
  python3 -m venv .venv && source .venv/bin/activate
  pip install -r requirements.txt
  export REPLICATE_API_TOKEN=...
  python generate_instrumental.py --all-concepts
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore[misc, assignment]

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent.parent
REPLICATE_ART_DIR = SCRIPT_DIR.parent / "replicate-art"
MODEL_REF = "minimax/music-2.6"

SAMPLE_RATES = (16000, 24000, 32000, 44100)
BITRATES = (32000, 64000, 128000, 256000)
AUDIO_FORMATS = ("mp3", "wav", "pcm")

# Three EP directions to pick a favorite full-album aesthetic later.
EP_CONCEPTS: tuple[dict[str, Any], ...] = (
    {
        "id": 1,
        "slug": "concept-01-arcade-pulse",
        "prompt": (
            "F major, 110 BPM, modern synth-pop electronic, bright uplifting arcade energy, "
            "bouncy synth bass, crisp digital drums, sparkling arpeggios, airy supersaw pads, "
            "subtle sidechain pump, wide soundstage, polished casual mobile-game lobby music, "
            "instrumental only, no vocals, no singing, no voice, no choir, no spoken word"
        ),
    },
    {
        "id": 2,
        "slug": "concept-02-lofi-stroll",
        "prompt": (
            "D major, 86 BPM, lo-fi hip-hop, relaxed study vibes, warm tape-style saturation, "
            "soft electric piano chords, dusty mellow kick and snare, rounded mellow bass guitar, "
            "gentle vinyl crackle very subtle, intimate close mix, low distraction background bed, "
            "instrumental only, no vocals, no singing, no voice, no choir, no spoken word"
        ),
    },
    {
        "id": 3,
        "slug": "concept-03-hills-adventure",
        "prompt": (
            "G major, 104 BPM, cheerful fantasy arcade hybrid, bright and playful not moody, "
            "bouncy quantized groove with light chiptune-style lead hooks layered over warm pennywhistle "
            "and fiddle lines, sparkly plucky synth arps, gentle orchestral strings for lift, "
            "tight punchy drums with a casual mobile-game lobby bounce, glossy polished mix, "
            "whimsical leprechaun-hills adventure energy, wide happy soundstage, "
            "instrumental only, no vocals, no singing, no voice, no choir, no spoken word"
        ),
    },
)


def load_env() -> None:
    if load_dotenv:
        load_dotenv(REPO_ROOT / ".env")
        load_dotenv(SCRIPT_DIR / ".env")
        load_dotenv(REPO_ROOT / "frontend" / ".env")
        load_dotenv(REPO_ROOT / "frontend" / ".env.local")


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


def _read_output_bytes(output: object) -> bytes:
    first = output[0] if isinstance(output, (list, tuple)) else output
    if hasattr(first, "read"):
        data = first.read()
        if isinstance(data, bytes):
            return data
        raise RuntimeError(f"read() did not return bytes: {type(data)}")
    raise RuntimeError(f"Unexpected output type: {type(first)}")


def _read_output_bytes_robust(output: object, *, job_label: str) -> bytes:
    """Download model output bytes; prefer fresh HTTP GET with retries for large audio."""
    first = output[0] if isinstance(output, (list, tuple)) else output
    url = getattr(first, "url", None)
    if isinstance(url, str) and url.startswith("http"):
        if httpx is None:
            return _read_output_bytes(output)
        last_exc: BaseException | None = None
        for attempt in range(1, 6):
            try:
                tol = httpx.Timeout(60.0, connect=60.0, read=900.0, write=60.0)
                with httpx.Client(timeout=tol, follow_redirects=True) as h:
                    r = h.get(url)
                    r.raise_for_status()
                    data = r.content
                if len(data) < 512:
                    raise RuntimeError(f"short download: {len(data)} bytes")
                return data
            except Exception as exc:
                last_exc = exc
                if attempt >= 5:
                    break
                wait = min(45.0, 3.0 * attempt)
                print(
                    f"[{job_label}] download failed ({exc!r}); retry {attempt}/5 in {wait:.0f}s",
                    file=sys.stderr,
                )
                time.sleep(wait)
        raise last_exc  # type: ignore[misc]
    return _read_output_bytes(output)


def build_input(
    *,
    prompt: str,
    sample_rate: int,
    bitrate: int,
    audio_format: str,
) -> dict[str, Any]:
    # Note: MiniMax docs mention a seed for reproducibility; the Replicate
    # ``minimax/music-2.6`` schema rejects ``seed`` (extra field) as of 2026-04.
    return {
        "prompt": prompt,
        "is_instrumental": True,
        "sample_rate": sample_rate,
        "bitrate": bitrate,
        "audio_format": audio_format,
    }


def run_generation(
    *,
    inp: dict[str, Any],
    dry_run: bool,
    out_path: Path,
    job_label: str,
    prefer_wait: int,
    max_wall_seconds: float | None,
) -> Path | None:
    if dry_run:
        print(f"[dry-run] {job_label} -> would write {out_path}")
        print(json.dumps(inp, indent=2))
        return None

    if not os.environ.get("REPLICATE_API_TOKEN", "").strip():
        print(
            "REPLICATE_API_TOKEN is not set. Add it to .env or the environment.",
            file=sys.stderr,
        )
        sys.exit(2)

    if str(REPLICATE_ART_DIR) not in sys.path:
        sys.path.insert(0, str(REPLICATE_ART_DIR))
    import replicate_bounded_run as bounded  # noqa: E402

    client = _client()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    output = bounded.run_model_bounded(
        client,
        MODEL_REF,
        inp,
        prefer_wait=prefer_wait,
        max_wall_seconds=max_wall_seconds,
        job_label=job_label,
        use_file_output=True,
        log_monitor=True,
        poll_progress=True,
    )
    data = _read_output_bytes_robust(output, job_label=job_label)
    out_path.write_bytes(data)
    print(f"[ok] {job_label} wrote {out_path} ({len(data)} bytes)")
    return out_path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Instrumental-only Minimax Music 2.6 via Replicate.")
    p.add_argument(
        "--concept",
        type=int,
        choices=(1, 2, 3),
        help="Generate one preset EP concept (1–3).",
    )
    p.add_argument(
        "--all-concepts",
        action="store_true",
        help="Generate all three EP concept instrumentals.",
    )
    p.add_argument(
        "--prompt",
        type=str,
        default="",
        help="Custom prompt (instrumental only). Use with --out; not combined with --concept.",
    )
    p.add_argument(
        "--out",
        type=Path,
        default=None,
        help="Output file path for custom --prompt (extension should match --audio-format).",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=SCRIPT_DIR / "output",
        help="Directory for concept outputs (default: ./output).",
    )
    p.add_argument(
        "--sample-rate",
        type=int,
        default=32000,
        choices=SAMPLE_RATES,
        help="Sample rate (default: 32000 — decent on laptop speakers, smaller than 44100).",
    )
    p.add_argument(
        "--bitrate",
        type=int,
        default=128000,
        choices=BITRATES,
        help="Bitrate (default: 128000).",
    )
    p.add_argument(
        "--audio-format",
        type=str,
        default="mp3",
        choices=AUDIO_FORMATS,
        help="Output container (default: mp3).",
    )
    p.add_argument(
        "--prefer-wait",
        type=int,
        default=1,
        help="Replicate Prefer: wait seconds (1..60). Default 1: return quickly and poll "
        "(avoids ~60s server disconnects on slow music generations).",
    )
    p.add_argument(
        "--max-wall-seconds",
        type=float,
        default=None,
        help="Override REPLICATE_MAX_GENERATION_SECONDS for this run.",
    )
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--resume",
        action="store_true",
        help="Skip a concept if its output file already exists (avoids re-spending on "
        "concept 1 after interrupted retries).",
    )
    return p.parse_args()


def main() -> None:
    load_env()
    args = parse_args()
    prefer_wait = max(1, min(60, args.prefer_wait))

    if args.concept is not None and args.all_concepts:
        print("Use either --concept or --all-concepts, not both.", file=sys.stderr)
        sys.exit(2)

    if args.prompt:
        if args.concept is not None or args.all_concepts:
            print("--prompt cannot be used with --concept or --all-concepts.", file=sys.stderr)
            sys.exit(2)
        if args.out is None:
            print("--out is required with --prompt.", file=sys.stderr)
            sys.exit(2)
        inp = build_input(
            prompt=args.prompt.strip(),
            sample_rate=args.sample_rate,
            bitrate=args.bitrate,
            audio_format=args.audio_format,
        )
        run_generation(
            inp=inp,
            dry_run=args.dry_run,
            out_path=args.out.resolve(),
            job_label="custom-instrumental",
            prefer_wait=prefer_wait,
            max_wall_seconds=args.max_wall_seconds,
        )
        return

    if args.concept is None and not args.all_concepts:
        print("Specify --concept N, --all-concepts, or --prompt with --out.", file=sys.stderr)
        sys.exit(2)

    concepts = EP_CONCEPTS if args.all_concepts else [c for c in EP_CONCEPTS if c["id"] == args.concept]
    if not concepts:
        sys.exit(2)

    out_dir = args.out_dir.resolve()
    manifest: list[dict[str, Any]] = []
    total = len(concepts)
    for idx, c in enumerate(concepts, start=1):
        ext = args.audio_format if args.audio_format != "pcm" else "pcm"
        out_path = out_dir / f"{c['slug']}.{ext}"
        preview = c["prompt"].replace("\n", " ")
        if len(preview) > 120:
            preview = preview[:117] + "..."
        print(
            f"[{c['slug']}] ({idx}/{total}) prompt preview: {preview}",
            file=sys.stderr,
        )
        if (
            args.resume
            and not args.dry_run
            and out_path.is_file()
            and out_path.stat().st_size >= 512
        ):
            print(
                f"[resume] skip existing output ({out_path.stat().st_size} bytes): {out_path}",
                file=sys.stderr,
            )
            manifest.append(
                {
                    "slug": c["slug"],
                    "concept_id": c["id"],
                    "model": MODEL_REF,
                    "is_instrumental": True,
                    "sample_rate": args.sample_rate,
                    "bitrate": args.bitrate,
                    "audio_format": args.audio_format,
                    "output": str(out_path),
                    "prompt": c["prompt"],
                    "skipped_existing": True,
                    "generated_at": datetime.now(timezone.utc).isoformat(),
                }
            )
            continue
        inp = build_input(
            prompt=c["prompt"],
            sample_rate=args.sample_rate,
            bitrate=args.bitrate,
            audio_format=args.audio_format,
        )
        written = run_generation(
            inp=inp,
            dry_run=args.dry_run,
            out_path=out_path,
            job_label=c["slug"],
            prefer_wait=prefer_wait,
            max_wall_seconds=args.max_wall_seconds,
        )
        manifest.append(
            {
                "slug": c["slug"],
                "concept_id": c["id"],
                "model": MODEL_REF,
                "is_instrumental": True,
                "sample_rate": args.sample_rate,
                "bitrate": args.bitrate,
                "audio_format": args.audio_format,
                "output": str(written) if written else None,
                "prompt": c["prompt"],
                "generated_at": datetime.now(timezone.utc).isoformat(),
            }
        )

    if not args.dry_run and len(concepts) > 1:
        man_path = out_dir / "manifest-ep-concepts.json"
        man_path.parent.mkdir(parents=True, exist_ok=True)
        man_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
        print(f"[ok] wrote {man_path}")


if __name__ == "__main__":
    main()

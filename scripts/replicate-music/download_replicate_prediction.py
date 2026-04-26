#!/usr/bin/env python3
# SPDX-License-Identifier: AGPL-3.0-only
"""Download audio (or any file URL) from a succeeded Replicate prediction by id.

Use when a generation succeeded on Replicate but the local download failed or the file
was never saved.

  export REPLICATE_API_TOKEN=...
  python download_replicate_prediction.py 166sxmx1hhrmr0cxs2ft1bs0dr \\
    --out output/album_part_1/06-starline-overworld.mp3

Id may be pasted from https://replicate.com/p/<id> (path or full URL accepted).
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[misc, assignment]

import generate_instrumental as inst


def _parse_prediction_id(raw: str) -> str:
    s = raw.strip()
    m = re.search(r"replicate\.com/p/([a-z0-9]+)", s, re.I)
    if m:
        return m.group(1)
    if re.fullmatch(r"[a-z0-9]+", s, re.I):
        return s
    raise SystemExit(f"Could not parse prediction id from: {raw!r}")


def _output_url(pred: object) -> str:
    out = getattr(pred, "output", None)
    if out is None:
        raise SystemExit("Prediction has no output yet (not succeeded?).")
    if isinstance(out, list):
        if not out:
            raise SystemExit("Prediction output is an empty list.")
        out = out[0]
    if isinstance(out, str) and out.startswith("http"):
        return out
    url = getattr(out, "url", None)
    if isinstance(url, str) and url.startswith("http"):
        return url
    raise SystemExit(f"Unexpected prediction.output type: {type(out)!r} value={out!r}")


def _download_url(url: str, *, job_label: str) -> bytes:
    if httpx is None:
        raise SystemExit("httpx is required (pip install httpx).")
    last: BaseException | None = None
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
            last = exc
            if attempt >= 5:
                break
            wait = min(45.0, 3.0 * attempt)
            print(
                f"[{job_label}] GET failed ({exc!r}); retry {attempt}/5 in {wait:.0f}s",
                file=sys.stderr,
            )
            import time

            time.sleep(wait)
    raise last  # type: ignore[misc]


def main() -> None:
    p = argparse.ArgumentParser(description="Download file from succeeded Replicate prediction.")
    p.add_argument("prediction_id", help="Prediction id or replicate.com/p/... URL")
    p.add_argument("--out", type=Path, required=True, help="Local file path to write")
    args = p.parse_args()

    inst.load_env()
    if not os.environ.get("REPLICATE_API_TOKEN", "").strip():
        print("REPLICATE_API_TOKEN is not set.", file=sys.stderr)
        sys.exit(2)

    pid = _parse_prediction_id(args.prediction_id)
    import replicate

    client = inst._client()
    pred = client.predictions.get(pid)
    st = getattr(pred, "status", "")
    if st != "succeeded":
        print(f"Prediction {pid} status={st!r} (need succeeded).", file=sys.stderr)
        sys.exit(1)

    url = _output_url(pred)
    out_path = args.out.resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    if out_path.is_file() and out_path.stat().st_size >= 512:
        print(f"[skip] already exists ({out_path.stat().st_size} bytes): {out_path}")
        return

    print(f"[download] {pid} from {url[:80]}...", file=sys.stderr)
    data = _download_url(url, job_label=pid)
    out_path.write_bytes(data)
    print(f"[ok] wrote {out_path} ({len(data)} bytes)")


if __name__ == "__main__":
    main()

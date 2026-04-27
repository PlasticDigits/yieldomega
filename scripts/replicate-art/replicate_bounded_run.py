# SPDX-License-Identifier: AGPL-3.0-only
"""Bounded polling for Replicate models (gpt-image-2 / OpenAI path).

OpenAI-backed generations here are expected to finish within ~10 minutes. If not,
we cancel the prediction and raise ``TimeoutError`` with the dashboard URL for
investigation (stuck queue, moderation hang, etc.).

Override with env ``REPLICATE_MAX_GENERATION_SECONDS`` (default ``600``).
"""

from __future__ import annotations

import os
import sys
import time
from typing import Any

DEFAULT_MAX_GENERATION_SECONDS = 600.0

# Replicate `predictions.create(..., wait=N)` keeps the HTTP response open for up to N
# seconds. Many proxies / CDNs drop long idle reads; the Python client then raises
# (e.g. RemoteProtocolError / "disconnected") *after* Replicate already accepted the job.
# Callers that wrap create+poll in an outer "retry whole job" loop then duplicate predictions.
# Short server wait + client-side reload polling matches Replicate's own guidance and
# sniper_shark_cutouts.py (prefer_wait=1).
_DEFAULT_CREATE_WAIT = 1


def _create_wait_seconds(requested: int) -> int:
    raw = os.environ.get("REPLICATE_CREATE_WAIT_SECONDS", "").strip()
    if raw:
        try:
            cap = max(1, min(60, int(raw)))
        except ValueError:
            cap = _DEFAULT_CREATE_WAIT
    else:
        cap = _DEFAULT_CREATE_WAIT
    # Never use a long-held create wait unless explicitly forced via env above.
    return max(1, min(cap, max(1, int(requested))))


def _is_transient_network_error(exc: BaseException) -> bool:
    text = f"{type(exc).__name__}: {exc!s}".lower()
    return any(
        n in text
        for n in (
            "remoteprotocolerror",
            "disconnected",
            "connection reset",
            "connection aborted",
            "broken pipe",
            "eof",
            "timed out",
            "timeout",
            "temporarily unavailable",
            "502",
            "503",
            "504",
        )
    )


def max_generation_seconds() -> float:
    raw = os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "").strip()
    if not raw:
        return DEFAULT_MAX_GENERATION_SECONDS
    return max(60.0, float(raw))


def _reload_prediction_resilient(prediction: Any, *, job_label: str) -> None:
    """``prediction.reload()`` with retries — same prediction id, no duplicate creates."""
    net_errors = 0
    while True:
        try:
            prediction.reload()
            return
        except Exception as exc:
            if not _is_transient_network_error(exc) or net_errors >= 40:
                raise
            net_errors += 1
            wait = min(8.0, 0.35 * net_errors + 0.15 * (net_errors**1.5))
            print(
                f"[{job_label}] reload flake ({exc!s}); same prediction "
                f"https://replicate.com/p/{getattr(prediction, 'id', '?')} "
                f"retry {net_errors}/40 in {wait:.1f}s…",
                file=sys.stderr,
            )
            time.sleep(wait)


def wait_prediction_bounded(
    prediction: Any,
    client: Any,
    *,
    max_seconds: float,
    job_label: str,
    poll_progress: bool = False,
) -> None:
    """Poll until terminal state or ``max_seconds``, then cancel and raise."""
    t0 = time.monotonic()
    last_log = t0
    while prediction.status not in ("succeeded", "failed", "canceled"):
        now = time.monotonic()
        if (
            poll_progress
            and now - last_log >= 30.0
            and now - t0 < max_seconds
        ):
            elapsed = now - t0
            print(
                f"[{job_label}] status={prediction.status!r} {elapsed:.0f}s / {max_seconds:.0f}s",
                file=sys.stderr,
            )
            last_log = now
        if now - t0 > max_seconds:
            try:
                prediction.cancel()
            except Exception as exc:
                print(
                    f"[{job_label}] deadline cancel failed (investigate manually): {exc}",
                    file=sys.stderr,
                )
            pid = getattr(prediction, "id", "?")
            raise TimeoutError(
                f"{job_label}: generation exceeded {max_seconds:.0f}s; canceled for investigation. "
                f"prediction_id={pid} last_status={getattr(prediction, 'status', '?')} "
                f"https://replicate.com/p/{pid}"
            )
        time.sleep(client.poll_interval)
        _reload_prediction_resilient(prediction, job_label=job_label)


def run_model_bounded(
    client: Any,
    model_ref: str,
    inp: dict,
    *,
    prefer_wait: int = 1,
    max_wall_seconds: float | None = None,
    job_label: str = "",
    use_file_output: bool = True,
    log_monitor: bool = True,
    poll_progress: bool = False,
) -> Any:
    """
    Create a model prediction, poll with a wall-clock cap, return file output like ``replicate.run``.
    """
    from replicate import identifier
    from replicate.exceptions import ModelError
    from replicate.helpers import transform_output

    version, owner, name, version_id = identifier._resolve(model_ref)
    if version_id is not None or not (owner and name):
        raise ValueError(
            f"replicate_bounded_run only supports owner/name models (got {model_ref!r}). "
            "Use replicate.run for version pins."
        )

    deadline = max_wall_seconds if max_wall_seconds is not None else max_generation_seconds()
    prediction = client.models.predictions.create(
        model=(owner, name),
        input=inp,
        wait=prefer_wait,
    )
    label = job_label or model_ref
    pid = getattr(prediction, "id", "?")
    if log_monitor:
        print(
            f"[{label}] monitoring prediction {pid} (max {deadline:.0f}s) — https://replicate.com/p/{pid}",
            file=sys.stderr,
        )
    wait_prediction_bounded(
        prediction, client, max_seconds=deadline, job_label=label, poll_progress=poll_progress
    )

    if prediction.status == "failed":
        raise ModelError(prediction)
    if prediction.status == "canceled":
        raise RuntimeError(f"{job_label}: prediction {prediction.id} canceled")
    if prediction.status != "succeeded":
        raise RuntimeError(
            f"{job_label}: unexpected status {prediction.status!r} id={prediction.id}"
        )

    if use_file_output:
        return transform_output(prediction.output, client)
    return prediction.output

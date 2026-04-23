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


def max_generation_seconds() -> float:
    raw = os.environ.get("REPLICATE_MAX_GENERATION_SECONDS", "").strip()
    if not raw:
        return DEFAULT_MAX_GENERATION_SECONDS
    return max(60.0, float(raw))


def wait_prediction_bounded(
    prediction: Any,
    client: Any,
    *,
    max_seconds: float,
    job_label: str,
) -> None:
    """Poll until terminal state or ``max_seconds``, then cancel and raise."""
    t0 = time.monotonic()
    while prediction.status not in ("succeeded", "failed", "canceled"):
        if time.monotonic() - t0 > max_seconds:
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
        prediction.reload()


def run_model_bounded(
    client: Any,
    model_ref: str,
    inp: dict,
    *,
    prefer_wait: int = 1,
    max_wall_seconds: float | None = None,
    job_label: str = "",
    use_file_output: bool = True,
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
    wait_prediction_bounded(prediction, client, max_seconds=deadline, job_label=job_label or model_ref)

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

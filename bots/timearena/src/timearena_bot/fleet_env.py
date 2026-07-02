# SPDX-License-Identifier: AGPL-3.0-only
"""Parse KEY_1..KEY_N and MEAN_1..MEAN_N wallet fleet environment pairs."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass


@dataclass(frozen=True)
class FleetWallet:
    """One fun-fleet worker slot (1-based index)."""

    index: int
    private_key: str
    mean_sec: float


def _normalize_private_key(raw: str) -> str:
    key = raw.strip()
    if key.startswith("0x") or key.startswith("0X"):
        key = key[2:]
    if not key:
        raise ValueError("private key is empty")
    return key


def load_fleet_wallets(*, environ: Mapping[str, str | None] | None = None) -> tuple[FleetWallet, ...]:
    """Load consecutive KEY_i / MEAN_i pairs starting at i=1 until KEY_i is unset."""
    env = os.environ if environ is None else environ
    wallets: list[FleetWallet] = []
    index = 1
    while True:
        key_raw = env.get(f"KEY_{index}")
        if key_raw is None or not key_raw.strip():
            break
        mean_raw = env.get(f"MEAN_{index}")
        if mean_raw is None or not mean_raw.strip():
            raise ValueError(f"KEY_{index} is set but MEAN_{index} is missing")
        try:
            mean_sec = max(1.0, float(mean_raw.strip()))
        except ValueError as e:
            raise ValueError(f"MEAN_{index} must be a number (seconds), got {mean_raw!r}") from e
        wallets.append(
            FleetWallet(
                index=index,
                private_key=_normalize_private_key(key_raw),
                mean_sec=mean_sec,
            )
        )
        index += 1
    return tuple(wallets)

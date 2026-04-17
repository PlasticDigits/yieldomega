# SPDX-License-Identifier: AGPL-3.0-only
"""Optional Anvil-only extra addresses for swarm one-shot funding (QA / human wallets)."""

from __future__ import annotations

import os
import re
from typing import Sequence

from web3 import Web3

_ENV_KEY = "YIELDOMEGA_ANVIL_EXTRA_FUNDED_ADDRESSES"


def parse_extra_funded_addresses(raw: str | None) -> list[str]:
    """
    Parse comma- or whitespace-separated Ethereum addresses from env text.
    Invalid tokens are skipped. Returns checksum addresses, order preserved (first occurrence wins).
    """
    if not raw or not str(raw).strip():
        return []
    tokens = [t for t in re.split(r"[,\s]+", str(raw).strip()) if t]
    out: list[str] = []
    seen: set[str] = set()
    for t in tokens:
        if not t.startswith("0x") or len(t) != 42:
            continue
        if not Web3.is_address(t):
            continue
        cs = Web3.to_checksum_address(t)
        low = cs.lower()
        if low in seen:
            continue
        seen.add(low)
        out.append(cs)
    return out


def extra_funded_addresses_from_environ() -> list[str]:
    return parse_extra_funded_addresses(os.environ.get(_ENV_KEY))


def merge_funded_recipients(base: Sequence[str], extras: Sequence[str]) -> tuple[list[str], int]:
    """
    Append extras to base with deduplication (case-insensitive). Returns (merged, num_new).
    """
    merged: list[str] = list(base)
    seen = {a.lower() for a in merged}
    n_new = 0
    for a in extras:
        low = a.lower()
        if low in seen:
            continue
        seen.add(low)
        merged.append(a)
        n_new += 1
    return merged, n_new

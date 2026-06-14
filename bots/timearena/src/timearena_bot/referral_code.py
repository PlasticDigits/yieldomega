# SPDX-License-Identifier: AGPL-3.0-only
"""Normalize + hash referral codes to match `ReferralRegistry` + frontend `referralCode.ts`."""

from __future__ import annotations

import os
from typing import Optional

from web3 import Web3


def normalize_referral_code(raw: str) -> str:
    t = raw.strip().lower()
    if len(t) < 3 or len(t) > 16:
        raise ValueError("Referral code must be 3–16 characters.")
    for c in t:
        if c not in "0123456789abcdefghijklmnopqrstuvwxyz":
            raise ValueError("Referral code may only contain letters and digits.")
    return t


def hash_referral_code_normalized(normalized: str) -> bytes:
    """Solidity `keccak256(bytes(normalized))` for ASCII codes."""
    return Web3.keccak(text=normalized)


def hash_referral_code(raw: str) -> bytes:
    return hash_referral_code_normalized(normalize_referral_code(raw))


def referral_code_from_env() -> Optional[str]:
    raw = (os.environ.get("YIELDOMEGA_REFERRAL_CODE") or "").strip()
    if not raw:
        return None
    return normalize_referral_code(raw)

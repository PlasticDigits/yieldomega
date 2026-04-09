# SPDX-License-Identifier: AGPL-3.0-only
"""Contract instances backed by checked-in minimal ABIs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List

from web3 import Web3
from web3.contract import Contract

_PKG = Path(__file__).resolve().parent


def _load_abi(name: str) -> List[Any]:
    p = _PKG / "abis" / name
    return json.loads(p.read_text(encoding="utf-8"))


def timecurve_contract(w3: Web3, address: str) -> Contract:
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=_load_abi("timecurve.json"))


def erc20_contract(w3: Web3, address: str) -> Contract:
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=_load_abi("erc20.json"))


def mock_reserve_contract(w3: Web3, address: str) -> Contract:
    """MockReserveCl8y `mint` (dev only)."""
    base = _load_abi("erc20.json")
    extra = _load_abi("mock_reserve.json")
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=base + extra)

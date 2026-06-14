# SPDX-License-Identifier: AGPL-3.0-only
"""Contract instances backed by checked-in minimal ABIs."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, List, Optional

from web3 import Web3
from web3.contract import Contract

_PKG = Path(__file__).resolve().parent


def _load_abi(name: str) -> List[Any]:
    p = _PKG / "abis" / name
    data = json.loads(p.read_text(encoding="utf-8"))
    if isinstance(data, dict) and "abi" in data:
        return data["abi"]
    if not isinstance(data, list):
        raise ValueError(f"{name}: expected ABI array or Foundry artifact with 'abi' key")
    return data


def timearena_contract(w3: Web3, address: str) -> Contract:
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=_load_abi("timearena.json"))


def timecurve_contract(w3: Web3, address: str) -> Contract:
    """Alias for Arena v2 (`TimeArena` proxy address in env)."""
    return timearena_contract(w3, address)


def erc20_contract(w3: Web3, address: str) -> Contract:
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=_load_abi("erc20.json"))


def mock_reserve_contract(w3: Web3, address: str) -> Contract:
    """Dev mintable ERC-20 (`MockReserveCl8y` or `Doubloon` with MINTER_ROLE)."""
    base = _load_abi("erc20.json")
    extra = _load_abi("mock_reserve.json")
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=base + extra)


def arena_doub_address(tc: Contract, *, explicit: Optional[str] = None) -> str:
    """DOUB token for TimeArena buys — env override or `TimeArena.doub()`."""
    if explicit:
        return Web3.to_checksum_address(explicit)
    return Web3.to_checksum_address(tc.functions.doub().call())


def referral_registry_contract(w3: Web3, address: str) -> Contract:
    return w3.eth.contract(address=Web3.to_checksum_address(address), abi=_load_abi("referral_registry.json"))

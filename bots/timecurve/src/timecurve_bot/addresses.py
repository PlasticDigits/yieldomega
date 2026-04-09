# SPDX-License-Identifier: AGPL-3.0-only
"""Load optional address registry JSON; checksum Ethereum addresses."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, Optional

from eth_utils import is_address, to_checksum_address

_HEX_ADDR = re.compile(r"^0x[a-fA-F0-9]{40}$")


def checksum_addr(addr: str) -> str:
    a = addr.strip()
    if not _HEX_ADDR.match(a):
        raise ValueError(f"Invalid address format: {addr!r}")
    if not is_address(a):
        raise ValueError(f"Not a valid address: {addr!r}")
    return to_checksum_address(a)


def load_registry_file(path: Path) -> Dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError("Address file must be a JSON object.")
    return data


def addresses_from_registry(data: Dict[str, Any]) -> Dict[str, Optional[str]]:
    """Support `contracts` block like stage2-anvil-registry.json or flat keys."""
    out: Dict[str, Optional[str]] = {
        "timecurve": None,
        "rabbit_treasury": None,
        "leprechaun_nft": None,
    }
    contracts = data.get("contracts")
    if isinstance(contracts, dict):
        out["timecurve"] = contracts.get("TimeCurve") or contracts.get("timecurve")
        out["rabbit_treasury"] = contracts.get("RabbitTreasury") or contracts.get("rabbit_treasury")
        out["leprechaun_nft"] = contracts.get("LeprechaunNFT") or contracts.get("leprechaun_nft")
    else:
        out["timecurve"] = data.get("YIELDOMEGA_TIMECURVE_ADDRESS") or data.get("timecurve")
        out["rabbit_treasury"] = data.get("YIELDOMEGA_RABBIT_TREASURY_ADDRESS") or data.get("rabbit_treasury")
        out["leprechaun_nft"] = data.get("YIELDOMEGA_LEPRECHAUN_NFT_ADDRESS") or data.get("leprechaun_nft")
    return out



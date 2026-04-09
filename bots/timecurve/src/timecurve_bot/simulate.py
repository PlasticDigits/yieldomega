# SPDX-License-Identifier: AGPL-3.0-only
"""Gas estimation helpers (non-authoritative; chain may differ on MegaETH)."""

from __future__ import annotations

from typing import Any, Dict

from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract


def estimate_contract_call(
    w3: Web3,
    account: LocalAccount,
    fn: Any,
) -> Dict[str, Any]:
    try:
        gas = fn.estimate_gas({"from": account.address})
        return {"ok": True, "gas": int(gas)}
    except Exception as e:
        return {"ok": False, "error": str(e)}

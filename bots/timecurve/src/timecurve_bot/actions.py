# SPDX-License-Identifier: AGPL-3.0-only
"""Build and optionally broadcast transactions (normal contract calls only)."""

from __future__ import annotations

import os
import time
from typing import Any, Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract

from timecurve_bot.referral_code import hash_referral_code, referral_code_from_env


def _tx_template(w3: Web3, account: LocalAccount) -> dict:
    return {
        "from": account.address,
        "nonce": w3.eth.get_transaction_count(account.address),
        "chainId": int(w3.eth.chain_id),
    }


def _gas_limit(estimated: int, gas_multiplier: float) -> int:
    """Avoid 'gas required exceeds allowance' when estimate is tight vs execution (e.g. heavy mint)."""
    raw = os.getenv("YIELDOMEGA_GAS_BUFFER", "100000").strip()
    buf = max(0, int(raw))
    return max(int(estimated * gas_multiplier), int(estimated) + buf)


def _build_and_send(
    w3: Web3,
    account: LocalAccount,
    tx: dict,
    gas_multiplier: float,
    send: bool,
    label: str,
) -> Optional[str]:
    if not send:
        return None
    gas = w3.eth.estimate_gas(tx)
    tx["gas"] = _gas_limit(gas, gas_multiplier)
    b = w3.eth.get_block("latest")
    base = b.get("baseFeePerGas")
    if base is not None:
        tip = w3.eth.max_priority_fee
        tx["maxFeePerGas"] = int(base) * 2 + int(tip)
        tx["maxPriorityFeePerGas"] = int(tip)
    else:
        tx["gasPrice"] = int(w3.eth.gas_price * gas_multiplier)
    signed = account.sign_transaction(tx)
    h = w3.eth.send_raw_transaction(signed.raw_transaction)
    rc = w3.eth.wait_for_transaction_receipt(h)
    print(f"{label} tx={rc['transactionHash'].hex()} status={rc['status']}")
    return rc["transactionHash"].hex()


def _wait_until_buy_allowed(w3: Web3, tc: Contract, account: LocalAccount) -> None:
    """Sleep until `block.timestamp >= nextBuyAllowedAt(sender)` so swarm buys do not spam reverts."""
    allowed_at = int(tc.functions.nextBuyAllowedAt(account.address).call())
    if allowed_at <= 0:
        return
    while True:
        head_ts = int(w3.eth.get_block("latest")["timestamp"])
        if head_ts >= allowed_at:
            return
        delay = min(15.0, max(0.5, float(allowed_at - head_ts)))
        time.sleep(delay)
        allowed_at = int(tc.functions.nextBuyAllowedAt(account.address).call())
        if allowed_at <= 0:
            return


def approve_if_needed(
    w3: Web3,
    asset: Contract,
    owner: LocalAccount,
    spender: str,
    amount: int,
    *,
    gas_multiplier: float,
    send: bool,
) -> Optional[str]:
    cur = int(asset.functions.allowance(owner.address, spender).call())
    if cur >= amount:
        return None
    fn = asset.functions.approve(spender, amount)
    tx = fn.build_transaction(_tx_template(w3, owner))
    return _build_and_send(w3, owner, tx, gas_multiplier, send, "approve")


def buy(
    w3: Web3,
    tc: Contract,
    account: LocalAccount,
    charm_wad: int,
    *,
    gas_multiplier: float,
    send: bool,
    referral_code: Optional[str] = None,
) -> Optional[str]:
    _wait_until_buy_allowed(w3, tc, account)
    code_src = referral_code if referral_code is not None else referral_code_from_env()
    if code_src:
        try:
            h = hash_referral_code(code_src)
        except ValueError as e:
            raise ValueError(f"Invalid referral code for buy: {e}") from e
        fn = tc.functions.buy(charm_wad, h, False)
    else:
        fn = tc.functions.buy(charm_wad)
    tx = fn.build_transaction(_tx_template(w3, account))
    return _build_and_send(w3, account, tx, gas_multiplier, send, f"buy({charm_wad})")


def claim_flag(
    w3: Web3,
    tc: Contract,
    account: LocalAccount,
    *,
    gas_multiplier: float,
    send: bool,
) -> Optional[str]:
    fn = tc.functions.claimWarBowFlag()
    tx = fn.build_transaction(_tx_template(w3, account))
    return _build_and_send(w3, account, tx, gas_multiplier, send, "claimWarBowFlag")


def warbow_steal(
    w3: Web3,
    tc: Contract,
    account: LocalAccount,
    victim: str,
    pay_bypass: bool,
    *,
    gas_multiplier: float,
    send: bool,
) -> Optional[str]:
    fn = tc.functions.warbowSteal(Web3.to_checksum_address(victim), pay_bypass)
    tx = fn.build_transaction(_tx_template(w3, account))
    return _build_and_send(w3, account, tx, gas_multiplier, send, "warbowSteal")


def warbow_guard(
    w3: Web3,
    tc: Contract,
    account: LocalAccount,
    *,
    gas_multiplier: float,
    send: bool,
) -> Optional[str]:
    fn = tc.functions.warbowActivateGuard()
    tx = fn.build_transaction(_tx_template(w3, account))
    return _build_and_send(w3, account, tx, gas_multiplier, send, "warbowActivateGuard")


def warbow_revenge(
    w3: Web3,
    tc: Contract,
    account: LocalAccount,
    stealer: str,
    *,
    gas_multiplier: float,
    send: bool,
) -> Optional[str]:
    fn = tc.functions.warbowRevenge(Web3.to_checksum_address(stealer))
    tx = fn.build_transaction(_tx_template(w3, account))
    return _build_and_send(w3, account, tx, gas_multiplier, send, "warbowRevenge")


def mint_mock_reserve(
    w3: Web3,
    token: Contract,
    from_account: LocalAccount,
    to: str,
    amount: int,
    *,
    gas_multiplier: float,
    send: bool,
) -> Optional[str]:
    fn = token.functions.mint(Web3.to_checksum_address(to), amount)
    tx = fn.build_transaction(_tx_template(w3, from_account))
    return _build_and_send(w3, from_account, tx, gas_multiplier, send, "mint(CL8Y mock)")


def account_from_config(private_key_hex: str) -> LocalAccount:
    key = private_key_hex if private_key_hex.startswith("0x") else "0x" + private_key_hex
    return Account.from_key(key)


def print_dry(name: str, detail: str) -> None:
    print(f"[dry-run] {name}: {detail}")

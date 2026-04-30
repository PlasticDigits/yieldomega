# SPDX-License-Identifier: AGPL-3.0-only
"""One-shot Anvil helper: register a shared swarm referral code from a dedicated HD index."""

from __future__ import annotations

import os
from typing import Optional

from eth_account import Account
from eth_account.signers.local import LocalAccount
from web3 import Web3
from web3.contract import Contract

from timecurve_bot.actions import _build_and_send, _tx_template, approve_if_needed
from timecurve_bot.contracts import erc20_contract, referral_registry_contract
from timecurve_bot.swarm_layout import REFERRAL_REGISTRAR_INDEX
from timecurve_bot.referral_code import normalize_referral_code


def swarm_referrals_enabled() -> bool:
    return os.environ.get("YIELDOMEGA_SWARM_REFERRALS", "1").strip() != "0"


def swarm_referral_code_raw() -> str:
    return (os.environ.get("YIELDOMEGA_SWARM_REFERRAL_CODE") or "swarmyo").strip()


def referral_registrar_index() -> int:
    return REFERRAL_REGISTRAR_INDEX


def ensure_swarm_referral_registered(
    w3: Web3,
    tc: Contract,
    asset: Contract,
    registrar: LocalAccount,
    *,
    gas_multiplier: float,
    send: bool,
) -> Optional[str]:
    """
    If TimeCurve has a referral registry and the registrar has no `ownerCode`,
    approve CL8Y and `registerCode` with `swarm_referral_code_raw()` (normalized).
    """
    if not swarm_referrals_enabled():
        return None
    try:
        code = normalize_referral_code(swarm_referral_code_raw())
    except ValueError as e:
        print(f"swarm referrals: invalid YIELDOMEGA_SWARM_REFERRAL_CODE ({e!s}) — skipping registration")
        return None

    reg_addr = tc.functions.referralRegistry().call()
    if not reg_addr or reg_addr == "0x0000000000000000000000000000000000000000":
        print("swarm referrals: TimeCurve.referralRegistry is zero — skipping")
        return None

    registry = referral_registry_contract(w3, Web3.to_checksum_address(reg_addr))
    owner_h = registry.functions.ownerCode(registrar.address).call()
    if int.from_bytes(owner_h, "big") != 0:
        print(f"swarm referrals: registrar {registrar.address} already has a code — skipping register")
        return None

    cl8y = registry.functions.cl8yToken().call()
    need = int(registry.functions.registrationBurnAmount().call())
    if not send:
        print(f"swarm referrals: would register {code!r} from {registrar.address} (dry-run)")
        return None

    cl8y_addr = Web3.to_checksum_address(cl8y)
    pay_token = asset if Web3.to_checksum_address(asset.address) == cl8y_addr else erc20_contract(w3, cl8y_addr)
    approve_if_needed(
        w3,
        pay_token,
        registrar,
        Web3.to_checksum_address(reg_addr),
        need,
        gas_multiplier=gas_multiplier,
        send=send,
    )
    fn = registry.functions.registerCode(code)
    tx = fn.build_transaction(_tx_template(w3, registrar))
    h = _build_and_send(w3, registrar, tx, gas_multiplier, send, f"registerCode({code!r})")
    print(f"swarm referrals: registered {code!r} for {registrar.address}")
    return h


def load_referral_registrar_account() -> LocalAccount:
    from timecurve_bot.anvil_accounts import private_key_hex

    pk = "0x" + private_key_hex(referral_registrar_index())
    return Account.from_key(pk)

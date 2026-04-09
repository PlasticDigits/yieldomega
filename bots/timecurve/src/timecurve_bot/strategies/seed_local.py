# SPDX-License-Identifier: AGPL-3.0-only
"""Deterministic local scenario: multi-wallet buys, hard-reset band, flag claim — for UI / indexer dev."""

from __future__ import annotations

from eth_account import Account

from timecurve_bot.actions import (
    account_from_config,
    approve_if_needed,
    buy,
    claim_flag,
    mint_mock_reserve,
    print_dry,
)
from timecurve_bot.config import BotConfig
from timecurve_bot.rpc import anvil_increase_time, ensure_anvil_cheat_allowed
from timecurve_bot.strategies.common import APPROVE_LARGE, charm_bounds
from web3 import Web3
from web3.contract import Contract

# Well-known Anvil test keys (local only — never use on mainnet).
_ANVIL_KEYS = (
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
)

_MINT_WAD = 10**30


def _accounts(cfg: BotConfig):
    if not cfg.private_key:
        raise ValueError("seed-local needs YIELDOMEGA_PRIVATE_KEY (funder / actor A).")
    a0 = account_from_config(cfg.private_key)
    a1 = Account.from_key("0x" + _ANVIL_KEYS[1])
    a2 = Account.from_key("0x" + _ANVIL_KEYS[2])
    return a0, a1, a2


def run(w3: Web3, cfg: BotConfig, tc: Contract, asset: Contract) -> None:
    ensure_anvil_cheat_allowed(cfg, w3)
    send = cfg.can_submit_transactions()

    a0, a1, a2 = _accounts(cfg)

    print(
        "seed-local: mint CL8Y -> A1,A2; staggered buys; hard-reset buy; C buy; flag silence+claim\n"
        f"  A0={a0.address}\n  A1={a1.address}\n  A2={a2.address}"
    )

    if not send:
        print_dry("seed-local", "pass --send with private key; requires --allow-anvil-cheat")
        return

    for label, acct in ("A1", a1), ("A2", a2):
        mint_mock_reserve(
            w3,
            asset,
            a0,
            acct.address,
            _MINT_WAD,
            gas_multiplier=cfg.gas_multiplier,
            send=True,
        )
        print(f"  minted CL8Y for {label}")

    mint_mock_reserve(w3, asset, a0, a0.address, _MINT_WAD, gas_multiplier=cfg.gas_multiplier, send=True)

    for acct in (a0, a1, a2):
        approve_if_needed(w3, asset, acct, tc.address, APPROVE_LARGE, gas_multiplier=cfg.gas_multiplier, send=True)

    # Staggered buys (re-read CHARM bounds after each time warp — envelope scales with elapsed sale time).
    lo, hi = charm_bounds(tc)
    buy(w3, tc, a0, lo, gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A0 min buy")
    anvil_increase_time(w3, 90)
    lo, hi = charm_bounds(tc)
    buy(w3, tc, a1, lo, gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A1 min buy (after +90s)")

    # Warp into hard-reset band then max buy from A0
    latest = w3.eth.get_block("latest")
    now = int(latest["timestamp"])
    dl = int(tc.functions.deadline().call())
    rem = dl - now
    if rem > 780:
        anvil_increase_time(w3, rem - 600)
    lo, hi = charm_bounds(tc)
    buy(w3, tc, a0, hi, gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A0 max buy in reset band (timerHardReset onchain if branch hit)")

    lo, hi = charm_bounds(tc)
    buy(w3, tc, a2, lo, gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A2 min buy (feed / podium motion)")

    # Flag: A1 buys to become holder, silence 301s, claim
    lo, hi = charm_bounds(tc)
    buy(w3, tc, a1, lo, gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A1 buy (flag plant)")
    anvil_increase_time(w3, 301)
    claim_flag(w3, tc, a1, gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A1 claimWarBowFlag (+BP onchain if silence held)")

    print("seed-local: done (inspect UI / indexer battle feed)")

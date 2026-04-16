# SPDX-License-Identifier: AGPL-3.0-only
"""Deterministic local scenario: multi-wallet buys; optional flag claim (on-chain time only)."""

from __future__ import annotations

import os
import random
import time

from eth_account import Account
from eth_account.signers.local import LocalAccount

from timecurve_bot.actions import (
    account_from_config,
    approve_if_needed,
    buy,
    claim_flag,
    mint_mock_reserve,
    print_dry,
)
from timecurve_bot.config import BotConfig
from timecurve_bot.strategies.common import APPROVE_LARGE, charm_bounds, charm_for_buy, loop_mean_sec
from web3 import Web3
from web3.contract import Contract

from timecurve_bot.anvil_accounts import private_key_hex
from timecurve_bot.swarm_layout import SEED_LOCAL_SLOTS

# Well-known Anvil test keys (local only — never use on mainnet).
_ANVIL_KEYS = (
    "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
)

_MINT_WAD = 10**30


def _deterministic_buys_and_flag(
    w3: Web3,
    cfg: BotConfig,
    tc: Contract,
    a0: LocalAccount,
    a1: LocalAccount,
    a2: LocalAccount,
) -> None:
    """Staggered buys and optional reset-band / flag paths without Anvil time RPC."""
    lo, hi = charm_bounds(tc)
    buy(w3, tc, a0, charm_for_buy(tc, lo), gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A0 min buy")
    lo, hi = charm_bounds(tc)
    buy(w3, tc, a1, charm_for_buy(tc, lo), gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A1 min buy")

    latest = w3.eth.get_block("latest")
    now = int(latest["timestamp"])
    dl = int(tc.functions.deadline().call())
    rem = dl - now
    if rem > 780:
        print("  seed-local: skip max buy in <13m reset band (remaining >780s; no dev time warp)")
    else:
        lo, hi = charm_bounds(tc)
        buy(w3, tc, a0, charm_for_buy(tc, hi), gas_multiplier=cfg.gas_multiplier, send=True)
        print("  A0 max buy in reset band (timerHardReset onchain if branch hit)")

    lo, hi = charm_bounds(tc)
    buy(w3, tc, a2, charm_for_buy(tc, lo), gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A2 min buy (feed / podium motion)")

    lo, hi = charm_bounds(tc)
    buy(w3, tc, a1, charm_for_buy(tc, lo), gas_multiplier=cfg.gas_multiplier, send=True)
    print("  A1 buy (flag plant)")
    print("  seed-local: claimWarBowFlag without +301s warp — may fail until silence window passes on-chain")
    try:
        claim_flag(w3, tc, a1, gas_multiplier=cfg.gas_multiplier, send=True)
        print("  A1 claimWarBowFlag (+BP onchain if silence held)")
    except Exception as e:
        print(f"  seed-local: claimWarBowFlag skipped ({e!s})")


def _accounts(cfg: BotConfig):
    """If YIELDOMEGA_SEED_LOCAL_SLOT is set (0–2), use disjoint HD triples (matches `timecurve-bot swarm`)."""
    raw = os.getenv("YIELDOMEGA_SEED_LOCAL_SLOT", "").strip()
    if raw != "":
        slot = int(raw, 10)
        if slot < 0 or slot >= len(SEED_LOCAL_SLOTS):
            raise ValueError("YIELDOMEGA_SEED_LOCAL_SLOT must be 0..2")
        t0, t1, t2 = SEED_LOCAL_SLOTS[slot]
        a0 = Account.from_key("0x" + private_key_hex(t0))
        a1 = Account.from_key("0x" + private_key_hex(t1))
        a2 = Account.from_key("0x" + private_key_hex(t2))
        return a0, a1, a2
    if not cfg.private_key:
        raise ValueError("seed-local needs YIELDOMEGA_PRIVATE_KEY (funder / actor A), or set YIELDOMEGA_SEED_LOCAL_SLOT.")
    a0 = account_from_config(cfg.private_key)
    a1 = Account.from_key("0x" + _ANVIL_KEYS[1])
    a2 = Account.from_key("0x" + _ANVIL_KEYS[2])
    return a0, a1, a2


def run(w3: Web3, cfg: BotConfig, tc: Contract, asset: Contract) -> None:
    raw_slot = os.getenv("YIELDOMEGA_SEED_LOCAL_SLOT", "").strip()
    send = cfg.can_submit_transactions()

    a0, a1, a2 = _accounts(cfg)

    print(
        "seed-local: mint CL8Y -> A1,A2; staggered buys; optional flag claim\n"
        f"  A0={a0.address}\n  A1={a1.address}\n  A2={a2.address}"
    )

    if not send:
        print_dry(
            "seed-local",
            "set YIELDOMEGA_SEND_TX=1, YIELDOMEGA_DRY_RUN=0, and keys (or CLI --send)",
        )
        return

    mean = loop_mean_sec("YIELDOMEGA_SEED_LOCAL_MEAN_SEC", "45")
    slot_i: int | None = None
    if raw_slot != "":
        slot_i = int(raw_slot, 10)
    # Swarm runs 3× seed-local: only slot 0 runs the full flag/timer scenario (others conflict on global flag state).
    run_full_scenario = raw_slot == "" or slot_i == 0
    print(
        f"seed-local: min-CHARM loop (mean inter-arrival={mean}s); "
        f"deterministic scenario={'yes' if run_full_scenario else 'no (slot>=1)'}"
    )

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

    if run_full_scenario:
        _deterministic_buys_and_flag(w3, cfg, tc, a0, a1, a2)
    else:
        print(f"  seed-local: slot {slot_i} — skipping deterministic scenario (parallel swarm)")

    print("seed-local: scenario done; continuing min-CHARM loop (A0→A1→A2) until sale ends")

    accts = (a0, a1, a2)
    cycle = 0
    while True:
        if bool(tc.functions.ended().call()):
            print("seed-local: sale ended; stopping.")
            return
        acct = accts[cycle % 3]
        cycle += 1
        lo, hi = charm_bounds(tc)
        print(f"seed-local: loop buy from {acct.address}")
        try:
            buy(w3, tc, acct, charm_for_buy(tc, lo), gas_multiplier=cfg.gas_multiplier, send=True)
        except Exception as e:
            print(f"seed-local: loop buy skipped ({e!s})")
        delay = random.expovariate(1.0 / mean)
        time.sleep(delay)

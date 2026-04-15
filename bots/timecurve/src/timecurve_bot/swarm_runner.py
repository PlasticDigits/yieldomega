# SPDX-License-Identifier: AGPL-3.0-only
"""Spawn 3× fun/shark/pvp/defender/seed-local + 3× rando; mint mock reserve to swarm wallets (Anvil only)."""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

from web3 import Web3

from timecurve_bot.actions import account_from_config, mint_mock_reserve
from timecurve_bot.anvil_accounts import address_at, private_key_hex
from timecurve_bot.config import load_config
from timecurve_bot.contracts import mock_reserve_contract, timecurve_contract
from timecurve_bot.rpc import anvil_set_balance, assert_chain_id, make_web3
from timecurve_bot.swarm_layout import (
    ALL_FUNDED_INDICES,
    DEFENDER_INDICES,
    FUN_INDICES,
    MIN_ANVIL_ACCOUNTS,
    PVP_PAIRS,
    RANDO_INDICES,
    SEED_LOCAL_SLOTS,
    SHARK_INDICES,
)

_REPO_ROOT = Path(__file__).resolve().parents[4]
_BOT_SRC = _REPO_ROOT / "bots" / "timecurve" / "src"
_PID_FILE = Path("/tmp/yieldomega_bot_swarm.pids")
_LOG_DIR = Path("/tmp")

# Plenty of mock CL8Y for max-CHARM buys and fee noise (wei, 18 decimals).
_MINT_WEI = 10**33
# Native ETH on Anvil for gas (10_000 ETH each — refills drained dev accounts).
_AIRDROP_ETH_WEI = 10_000 * 10**18
# Slight delay between subprocess spawns to avoid hammering JSON-RPC at startup.
_SPAWN_STAGGER_SEC = 0.08


def _repo_root() -> Path:
    return _REPO_ROOT


def _mint_to_indices(w3: Web3, deployer_pk: str, asset, indices: tuple[int, ...]) -> None:
    deployer = account_from_config(deployer_pk)
    for i in indices:
        addr = Web3.to_checksum_address(address_at(i))
        mint_mock_reserve(
            w3,
            asset,
            deployer,
            addr,
            _MINT_WEI,
            gas_multiplier=1.2,
            send=True,
        )
    print(f"swarm: minted {_MINT_WEI} wei mock reserve to {len(indices)} addresses.")


def _fund_eth_to_indices(w3: Web3, indices: tuple[int, ...]) -> None:
    for i in indices:
        addr = Web3.to_checksum_address(address_at(i))
        anvil_set_balance(w3, addr, _AIRDROP_ETH_WEI)
    eth = _AIRDROP_ETH_WEI // 10**18
    print(f"swarm: anvil_setBalance {eth} ETH for {len(indices)} swarm addresses (gas).")


def run_swarm(*, skip_mint: bool = False) -> None:
    """Start background bot processes; writes /tmp/yieldomega_bot_swarm.pids."""
    if _PID_FILE.exists():
        print("swarm: warning: existing PID file — remove stale processes or delete", _PID_FILE, file=sys.stderr)

    cfg = load_config(env_file=None, send=True, allow_anvil_cheat=True)
    if cfg.chain_id != 31337:
        print("swarm: refusing — only chain 31337 (Anvil) is supported.", file=sys.stderr)
        raise SystemExit(2)

    w3 = make_web3(cfg.rpc_url)
    assert_chain_id(w3, cfg.chain_id)
    tc = timecurve_contract(w3, cfg.timecurve_address)
    aa = cfg.accepted_asset_address or tc.functions.acceptedAsset().call()
    asset = mock_reserve_contract(w3, Web3.to_checksum_address(aa))

    funder = private_key_hex(0)
    if not skip_mint:
        print("swarm: minting excess mock reserve to swarm indices", ALL_FUNDED_INDICES[0], "..", ALL_FUNDED_INDICES[-1])
        _mint_to_indices(w3, funder, asset, ALL_FUNDED_INDICES)
    print("swarm: topping up native ETH on swarm wallets (anvil_setBalance)")
    _fund_eth_to_indices(w3, ALL_FUNDED_INDICES)

    env_base = os.environ.copy()
    env_base["PYTHONPATH"] = str(_BOT_SRC)
    env_base["PYTHONUNBUFFERED"] = "1"
    # Rely on env for tx + cheats (avoids Typer global-option parsing issues in subprocesses).
    env_base["YIELDOMEGA_SEND_TX"] = "1"
    env_base["YIELDOMEGA_DRY_RUN"] = "0"
    env_base["YIELDOMEGA_ALLOW_ANVIL_CHEAT"] = "1"

    py = sys.executable

    jobs: list[tuple[str, list[str], dict[str, str]]] = []

    for slot, triple in enumerate(SEED_LOCAL_SLOTS):
        pk0 = private_key_hex(triple[0])
        env = dict(env_base)
        env["YIELDOMEGA_PRIVATE_KEY"] = pk0
        env["YIELDOMEGA_SEED_LOCAL_SLOT"] = str(slot)
        jobs.append((f"seed-local-{slot}", [py, "-u", "-m", "timecurve_bot.cli", "seed-local"], env))

    for i, d in enumerate(DEFENDER_INDICES):
        env = dict(env_base)
        env["YIELDOMEGA_PRIVATE_KEY"] = private_key_hex(d)
        jobs.append((f"defender-{i}", [py, "-u", "-m", "timecurve_bot.cli", "defender", "--steps", "3"], env))

    for i, f in enumerate(FUN_INDICES):
        env = dict(env_base)
        env["YIELDOMEGA_PRIVATE_KEY"] = private_key_hex(f)
        jobs.append((f"fun-{i}", [py, "-u", "-m", "timecurve_bot.cli", "fun"], env))

    for i, s in enumerate(SHARK_INDICES):
        env = dict(env_base)
        env["YIELDOMEGA_PRIVATE_KEY"] = private_key_hex(s)
        jobs.append((f"shark-{i}", [py, "-u", "-m", "timecurve_bot.cli", "shark"], env))

    for i, (atk, vic) in enumerate(PVP_PAIRS):
        env = dict(env_base)
        env["YIELDOMEGA_PRIVATE_KEY"] = private_key_hex(atk)
        env["YIELDOMEGA_PVP_VICTIM_PRIVATE_KEY"] = private_key_hex(vic)
        jobs.append((f"pvp-{i}", [py, "-u", "-m", "timecurve_bot.cli", "pvp"], env))

    for i, r in enumerate(RANDO_INDICES):
        env = dict(env_base)
        env["YIELDOMEGA_PRIVATE_KEY"] = private_key_hex(r)
        jobs.append((f"rando-{i}", [py, "-u", "-m", "timecurve_bot.cli", "rando"], env))

    pids: list[int] = []
    _PID_FILE.write_text("")
    for name, argv, env in jobs:
        log_path = _LOG_DIR / f"yieldomega_swarm_{name}.log"
        with open(log_path, "a", encoding="utf-8") as logf:
            p = subprocess.Popen(
                argv,
                cwd=str(_REPO_ROOT),
                env=env,
                stdout=logf,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
        pids.append(p.pid)
        print(f"swarm: started {name} pid={p.pid} log={log_path}")
        time.sleep(_SPAWN_STAGGER_SEC)
        with open(_PID_FILE, "a", encoding="utf-8") as pf:
            pf.write(f"{p.pid}\n")

    print(f"swarm: {len(pids)} processes; PIDs in {_PID_FILE}")
    print(f"swarm: requires Anvil with at least {MIN_ANVIL_ACCOUNTS} dev accounts (see start-local-anvil-stack.sh).")

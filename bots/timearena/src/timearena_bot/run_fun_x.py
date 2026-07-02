# SPDX-License-Identifier: AGPL-3.0-only
"""Supervise N independent `fun` workers from KEY_1..KEY_N and MEAN_1..MEAN_N."""

from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from pathlib import Path

from eth_account import Account

from timearena_bot.config import BotConfig, load_config
from timearena_bot.fleet_env import FleetWallet, load_fleet_wallets

_REPO_ROOT = Path(__file__).resolve().parents[4]
_BOT_SRC = _REPO_ROOT / "bots" / "timearena" / "src"
_SUPERVISOR_POLL_SEC = 2.0
_CRASH_RESTART_DELAY_SEC = 5.0


@dataclass
class _WorkerProc:
    wallet: FleetWallet
    process: subprocess.Popen[str]
    finished: bool = False


def _prefix_stream(stream, prefix: str, target) -> None:
    for line in stream:
        target.write(f"{prefix}{line}")
        target.flush()
    stream.close()


def _spawn_worker(
    wallet: FleetWallet,
    *,
    env_base: dict[str, str],
    python: str,
    cwd: str,
) -> subprocess.Popen[str]:
    env = dict(env_base)
    env["YIELDOMEGA_PRIVATE_KEY"] = wallet.private_key
    env["YIELDOMEGA_FUN_MEAN_SEC"] = str(wallet.mean_sec)
    env["YIELDOMEGA_SEND_TX"] = "1"
    env["YIELDOMEGA_DRY_RUN"] = "0"
    env["PYTHONPATH"] = str(_BOT_SRC)
    env["PYTHONUNBUFFERED"] = "1"

    proc = subprocess.Popen(
        [python, "-u", "-m", "timearena_bot.cli", "fun"],
        cwd=cwd,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        start_new_session=False,
    )
    assert proc.stdout is not None
    prefix = f"fun-{wallet.index}: "
    threading.Thread(
        target=_prefix_stream,
        args=(proc.stdout, prefix, sys.stdout),
        daemon=True,
        name=f"fun-{wallet.index}-log",
    ).start()
    return proc


def run_fun_fleet(*, cfg: BotConfig | None = None) -> None:
    """Start one `fun` subprocess per KEY_i/MEAN_i; supervise until all exit or SIGTERM."""
    wallets = load_fleet_wallets()
    if not wallets:
        print(
            "run-fun-x: set KEY_1 and MEAN_1 (then KEY_2/MEAN_2, …) for each wallet.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    if cfg is None:
        cfg = load_config(env_file=None, send=True, allow_anvil_funding=False)
    if not cfg.fleet_supervisor_send_ok():
        print(
            "run-fun-x: pass --send (or YIELDOMEGA_SEND_TX=1 with YIELDOMEGA_DRY_RUN=0) "
            "and configure RPC / TimeArena addresses.",
            file=sys.stderr,
        )
        raise SystemExit(2)

    env_base = os.environ.copy()
    python = sys.executable
    cwd = str(_REPO_ROOT if _REPO_ROOT.is_dir() else Path.cwd())

    shutdown = False

    def _handle_signal(signum: int, _frame) -> None:
        nonlocal shutdown
        shutdown = True
        print(f"run-fun-x: signal {signum}; stopping workers…", flush=True)

    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    workers: dict[int, _WorkerProc] = {}
    for wallet in wallets:
        try:
            address = Account.from_key("0x" + wallet.private_key).address
        except Exception as e:
            print(f"run-fun-x: invalid KEY_{wallet.index} ({e!s})", file=sys.stderr)
            raise SystemExit(2) from e
        proc = _spawn_worker(wallet, env_base=env_base, python=python, cwd=cwd)
        workers[wallet.index] = _WorkerProc(wallet=wallet, process=proc)
        print(
            f"run-fun-x: started fun-{wallet.index} pid={proc.pid} "
            f"address={address} mean={wallet.mean_sec}s",
            flush=True,
        )
        time.sleep(0.05)

    print(f"run-fun-x: supervising {len(workers)} worker(s)", flush=True)

    while not shutdown:
        active = 0
        for slot, worker in list(workers.items()):
            code = worker.process.poll()
            if code is None:
                active += 1
                continue
            if worker.finished:
                continue
            worker.finished = True
            if code == 0:
                print(
                    f"run-fun-x: fun-{slot} exited cleanly (code 0); not restarting",
                    flush=True,
                )
                continue
            if shutdown:
                continue
            print(
                f"run-fun-x: fun-{slot} crashed (code {code}); "
                f"restarting in {_CRASH_RESTART_DELAY_SEC}s",
                flush=True,
            )
            time.sleep(_CRASH_RESTART_DELAY_SEC)
            if shutdown:
                break
            worker.process = _spawn_worker(
                worker.wallet,
                env_base=env_base,
                python=python,
                cwd=cwd,
            )
            worker.finished = False
            active += 1
            print(
                f"run-fun-x: restarted fun-{slot} pid={worker.process.pid}",
                flush=True,
            )

        if active == 0:
            print("run-fun-x: all workers finished", flush=True)
            break
        time.sleep(_SUPERVISOR_POLL_SEC)

    for slot, worker in workers.items():
        if worker.process.poll() is None:
            print(f"run-fun-x: terminating fun-{slot} pid={worker.process.pid}", flush=True)
            worker.process.terminate()
    deadline = time.time() + 15.0
    for worker in workers.values():
        while worker.process.poll() is None and time.time() < deadline:
            time.sleep(0.2)
        if worker.process.poll() is None:
            worker.process.kill()

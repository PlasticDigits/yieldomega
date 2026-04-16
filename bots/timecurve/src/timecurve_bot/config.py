# SPDX-License-Identifier: AGPL-3.0-only
"""Environment-based configuration. No secrets in code; use .env / shell exports."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv

from timecurve_bot.addresses import (
    addresses_from_registry,
    checksum_addr,
    load_registry_file,
)


def _truthy(val: Optional[str]) -> bool:
    if val is None:
        return False
    return val.strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class BotConfig:
    rpc_url: str
    chain_id: int
    private_key: Optional[str]
    timecurve_address: str
    rabbit_treasury_address: Optional[str]
    leprechaun_nft_address: Optional[str]
    accepted_asset_address: Optional[str]
    address_file: Optional[Path]
    poll_interval_sec: float
    gas_multiplier: float
    charm_wad_fun: int
    charm_wad_shark: int
    send_transactions: bool
    # When true, rpc.anvil_dev_bootstrap_funding_if_enabled may use Anvil JSON-RPC (31337 only).
    allow_anvil_funding: bool

    def can_submit_transactions(self) -> bool:
        return bool(self.private_key) and self.send_transactions


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw.strip(), 0)


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw.strip())


def load_dotenv_files(explicit_env_file: Optional[Path] = None) -> None:
    """Load `.env` then optional explicit file (e.g. `.env.local`)."""
    load_dotenv(".env", override=False)
    if explicit_env_file is not None and explicit_env_file.is_file():
        load_dotenv(explicit_env_file, override=True)
    # Repo convention: bots/timecurve/.env.local when run from package dir
    local = Path("bots/timecurve/.env.local")
    if local.is_file():
        load_dotenv(local, override=True)
    local2 = Path(".env.local")
    if local2.is_file():
        load_dotenv(local2, override=True)


def load_config(
    *,
    env_file: Optional[Path] = None,
    send: bool = False,
    allow_anvil_funding: bool = False,
) -> BotConfig:
    load_dotenv_files(env_file)

    rpc = os.getenv("YIELDOMEGA_RPC_URL") or os.getenv("RPC_URL")
    if not rpc:
        raise ValueError("Set YIELDOMEGA_RPC_URL or RPC_URL to an HTTP JSON-RPC endpoint.")

    chain_id = _env_int("YIELDOMEGA_CHAIN_ID", 31337)

    pk = os.getenv("YIELDOMEGA_PRIVATE_KEY")
    if pk:
        pk = pk.strip()
        if pk.startswith("0x"):
            pk = pk[2:]

    tc = os.getenv("YIELDOMEGA_TIMECURVE_ADDRESS", "").strip()
    rt = os.getenv("YIELDOMEGA_RABBIT_TREASURY_ADDRESS", "").strip() or None
    nft = os.getenv("YIELDOMEGA_LEPRECHAUN_NFT_ADDRESS", "").strip() or None
    aa = os.getenv("YIELDOMEGA_ACCEPTED_ASSET_ADDRESS", "").strip() or None

    af = os.getenv("YIELDOMEGA_ADDRESS_FILE", "").strip()
    address_file = Path(af).resolve() if af else None

    if address_file and address_file.is_file():
        reg = addresses_from_registry(load_registry_file(address_file))
        if not tc and reg["timecurve"]:
            tc = str(reg["timecurve"])
        rt = rt or (reg["rabbit_treasury"] and str(reg["rabbit_treasury"]))
        nft = nft or (reg["leprechaun_nft"] and str(reg["leprechaun_nft"]))

    if not tc:
        raise ValueError("Set YIELDOMEGA_TIMECURVE_ADDRESS or YIELDOMEGA_ADDRESS_FILE with TimeCurve.")

    tc = checksum_addr(tc)
    rt = checksum_addr(rt) if rt else None
    nft = checksum_addr(nft) if nft else None
    aa = checksum_addr(aa) if aa else None

    poll = _env_float("YIELDOMEGA_POLL_INTERVAL_SEC", 30.0)
    gas_mult = _env_float("YIELDOMEGA_GAS_MULTIPLIER", 1.1)

    charm_fun = _env_int("YIELDOMEGA_CHARM_WAD_FUN", 0)  # 0 = use onchain min at runtime
    charm_shark = _env_int("YIELDOMEGA_CHARM_WAD_SHARK", 0)  # 0 = use onchain max at runtime

    env_send = _truthy(os.getenv("YIELDOMEGA_SEND_TX"))
    dry = _truthy(os.getenv("YIELDOMEGA_DRY_RUN", "1"))
    # CLI --send always allows submission when a private key is present (overrides DRY_RUN).
    if send:
        send_tx = bool(pk)
    else:
        send_tx = bool(pk) and env_send and not dry

    allow_funding = allow_anvil_funding or _truthy(os.getenv("YIELDOMEGA_ALLOW_ANVIL_FUNDING"))

    return BotConfig(
        rpc_url=rpc.rstrip("/"),
        chain_id=chain_id,
        private_key=pk,
        timecurve_address=tc,
        rabbit_treasury_address=rt,
        leprechaun_nft_address=nft,
        accepted_asset_address=aa,
        address_file=address_file,
        poll_interval_sec=poll,
        gas_multiplier=gas_mult,
        charm_wad_fun=charm_fun,
        charm_wad_shark=charm_shark,
        send_transactions=send_tx,
        allow_anvil_funding=allow_funding,
    )

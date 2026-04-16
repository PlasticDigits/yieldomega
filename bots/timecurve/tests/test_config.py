# SPDX-License-Identifier: AGPL-3.0-only
from pathlib import Path

import pytest

from timecurve_bot.config import load_config


def test_load_config_minimal(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("YIELDOMEGA_DRY_RUN", raising=False)
    monkeypatch.delenv("YIELDOMEGA_SEND_TX", raising=False)
    monkeypatch.setenv("YIELDOMEGA_RPC_URL", "http://127.0.0.1:8545")
    monkeypatch.setenv("YIELDOMEGA_CHAIN_ID", "31337")
    monkeypatch.setenv(
        "YIELDOMEGA_TIMECURVE_ADDRESS",
        "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    )
    cfg = load_config(send=False, allow_anvil_funding=False)
    assert cfg.rpc_url == "http://127.0.0.1:8545"
    assert cfg.chain_id == 31337
    assert cfg.send_transactions is False
    assert cfg.timecurve_address.startswith("0x")


def test_send_with_cli(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("YIELDOMEGA_RPC_URL", "http://127.0.0.1:8545")
    monkeypatch.setenv("YIELDOMEGA_CHAIN_ID", "31337")
    monkeypatch.setenv(
        "YIELDOMEGA_TIMECURVE_ADDRESS",
        "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    )
    monkeypatch.setenv(
        "YIELDOMEGA_PRIVATE_KEY",
        "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    )
    cfg = load_config(send=True, allow_anvil_funding=False)
    assert cfg.send_transactions is True


def test_send_blocked_by_dry_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("YIELDOMEGA_RPC_URL", "http://127.0.0.1:8545")
    monkeypatch.setenv("YIELDOMEGA_CHAIN_ID", "31337")
    monkeypatch.setenv(
        "YIELDOMEGA_TIMECURVE_ADDRESS",
        "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
    )
    monkeypatch.setenv(
        "YIELDOMEGA_PRIVATE_KEY",
        "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    )
    monkeypatch.setenv("YIELDOMEGA_DRY_RUN", "1")
    monkeypatch.setenv("YIELDOMEGA_SEND_TX", "1")
    cfg = load_config(send=False, allow_anvil_funding=False)
    assert cfg.send_transactions is False


def test_registry_file_fills_timecurve(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    # Isolate from repo .env.local (dotenv override would otherwise mask registry-driven address).
    monkeypatch.chdir(tmp_path)
    reg = tmp_path / "reg.json"
    reg.write_text(
        '{"contracts":{"TimeCurve":"0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0"}}',
        encoding="utf-8",
    )
    monkeypatch.setenv("YIELDOMEGA_RPC_URL", "http://127.0.0.1:8545")
    monkeypatch.setenv("YIELDOMEGA_CHAIN_ID", "31337")
    monkeypatch.delenv("YIELDOMEGA_TIMECURVE_ADDRESS", raising=False)
    monkeypatch.setenv("YIELDOMEGA_ADDRESS_FILE", str(reg))
    cfg = load_config(send=False, allow_anvil_funding=False)
    assert "A51c1fc2" in cfg.timecurve_address

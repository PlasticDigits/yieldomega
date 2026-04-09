# SPDX-License-Identifier: AGPL-3.0-only
import json
from pathlib import Path

import pytest

from timecurve_bot.addresses import addresses_from_registry, checksum_addr, load_registry_file


def test_checksum_addr() -> None:
    a = checksum_addr("0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
    assert a.startswith("0x")
    assert len(a) == 42


def test_checksum_invalid() -> None:
    with pytest.raises(ValueError):
        checksum_addr("not-an-address")


def test_load_registry(tmp_path: Path) -> None:
    p = tmp_path / "r.json"
    p.write_text(
        json.dumps(
            {
                "contracts": {
                    "TimeCurve": "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0",
                    "RabbitTreasury": "0x0165878A594ca255338adfa4d48449f69242Eb8F",
                }
            }
        ),
        encoding="utf-8",
    )
    data = load_registry_file(p)
    ad = addresses_from_registry(data)
    assert ad["timecurve"] == "0xA51c1fc2f0D1a1b8494Ed1FE312d7C3a78Ed91C0"
    assert ad["rabbit_treasury"] == "0x0165878A594ca255338adfa4d48449f69242Eb8F"
    assert ad["leprechaun_nft"] is None

# SPDX-License-Identifier: AGPL-3.0-only
from unittest.mock import patch

import pytest

from timecurve_bot import swarm_runner


def test_load_config_for_swarm_valueerror_prints_hint(capsys: pytest.CaptureFixture[str]) -> None:
    with patch.object(
        swarm_runner,
        "load_config",
        side_effect=ValueError("Set YIELDOMEGA_RPC_URL or RPC_URL …"),
    ):
        with pytest.raises(SystemExit) as excinfo:
            swarm_runner._load_config_for_swarm()
    assert excinfo.value.code == 2
    err = capsys.readouterr().err
    assert "config error:" in err
    assert "sync-bot-env-from-frontend" in err

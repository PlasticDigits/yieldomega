# SPDX-License-Identifier: AGPL-3.0-only
"""CLI entrypoint: inspect, strategies, local seed scenario."""

from __future__ import annotations

from pathlib import Path
from typing import Optional, Tuple

import typer
from web3 import Web3
from web3.contract.contract import Contract

from timecurve_bot.config import BotConfig, load_config
from timecurve_bot.contracts import mock_reserve_contract, timecurve_contract
from timecurve_bot.rpc import assert_chain_id, make_web3
from timecurve_bot.state import fetch_sale_snapshot, format_snapshot_human
from timecurve_bot.strategies import defender, fun, pvp, seed_local, shark

app = typer.Typer(
    no_args_is_help=True,
    help="TimeCurve client bot — onchain state is authoritative; bots only submit normal txs.",
)


@app.callback()
def _main(
    ctx: typer.Context,
    send: bool = typer.Option(
        False,
        "--send",
        help="Submit transactions (requires YIELDOMEGA_PRIVATE_KEY). Overrides default dry-run.",
    ),
    allow_anvil_cheat: bool = typer.Option(
        False,
        "--allow-anvil-cheat",
        help="Allow anvil_increaseTime / anvil_mine (YIELDOMEGA_CHAIN_ID must be 31337). Never on public RPC.",
    ),
    env_file: Optional[Path] = typer.Option(
        None,
        "--env-file",
        exists=True,
        dir_okay=False,
        help="Optional dotenv file (after default .env loads).",
    ),
) -> None:
    try:
        cfg = load_config(env_file=env_file, send=send, allow_anvil_cheat=allow_anvil_cheat)
    except ValueError as e:
        typer.echo(str(e), err=True)
        raise typer.Exit(code=2) from e
    ctx.obj = cfg


def _connect(cfg: BotConfig) -> Tuple[Web3, Contract, Contract]:
    w3 = make_web3(cfg.rpc_url)
    assert_chain_id(w3, cfg.chain_id)
    tc = timecurve_contract(w3, cfg.timecurve_address)
    aa = cfg.accepted_asset_address or tc.functions.acceptedAsset().call()
    asset = mock_reserve_contract(w3, Web3.to_checksum_address(aa))
    return w3, tc, asset


@app.command("inspect")
def cmd_inspect(ctx: typer.Context) -> None:
    """Print concise sale state, podiums, WarBow top-3, and config hints."""
    cfg: BotConfig = ctx.obj
    w3, tc, _asset = _connect(cfg)
    snap = fetch_sale_snapshot(w3, tc, cfg.chain_id)
    typer.echo(
        format_snapshot_human(
            snap,
            rpc_url=cfg.rpc_url,
            timecurve=cfg.timecurve_address,
        )
    )
    if cfg.rabbit_treasury_address:
        typer.echo(f"RabbitTreasury (env): {cfg.rabbit_treasury_address}")
    if cfg.leprechaun_nft_address:
        typer.echo(f"LeprechaunNFT (env): {cfg.leprechaun_nft_address}")
    typer.echo(f"send_transactions={cfg.send_transactions}  allow_anvil_cheat={cfg.allow_anvil_cheat}")


@app.command("fun")
def cmd_fun(ctx: typer.Context) -> None:
    """Single conservative buy at current min CHARM (dry-run unless --send)."""
    cfg: BotConfig = ctx.obj
    w3, tc, asset = _connect(cfg)
    fun.run(w3, cfg, tc, asset)


@app.command("shark")
def cmd_shark(
    ctx: typer.Context,
    warp_reset: bool = typer.Option(
        True,
        "--warp-reset/--no-warp-reset",
        help="With Anvil cheat: warp timer toward <13m remaining before max buy.",
    ),
) -> None:
    """Aggressive max-CHARM buy; optional timer warp for hard-reset branch (local)."""
    cfg: BotConfig = ctx.obj
    w3, tc, asset = _connect(cfg)
    shark.run(w3, cfg, tc, asset, warp_reset=warp_reset)


@app.command("pvp")
def cmd_pvp(ctx: typer.Context) -> None:
    """Victim buys for BP; attacker warbowSteal (needs YIELDOMEGA_PVP_VICTIM_PRIVATE_KEY or Anvil key #1)."""
    cfg: BotConfig = ctx.obj
    w3, tc, asset = _connect(cfg)
    pvp.run(w3, cfg, tc, asset)


@app.command("defender")
def cmd_defender(
    ctx: typer.Context,
    steps: int = typer.Option(3, "--steps", help="Number of qualifying buys (1–20)."),
) -> None:
    """Repeated under-window buys to grow defended streak (Anvil time warp)."""
    if steps < 1 or steps > 20:
        typer.echo("steps must be between 1 and 20", err=True)
        raise typer.Exit(2)
    cfg: BotConfig = ctx.obj
    w3, tc, asset = _connect(cfg)
    defender.run(w3, cfg, tc, asset, steps=steps)


@app.command("seed-local")
def cmd_seed_local(ctx: typer.Context) -> None:
    """Deterministic multi-wallet scenario for local UI / indexer (requires --send --allow-anvil-cheat)."""
    cfg: BotConfig = ctx.obj
    w3, tc, asset = _connect(cfg)
    seed_local.run(w3, cfg, tc, asset)


@app.command("scenario")
def cmd_scenario(ctx: typer.Context) -> None:
    """Alias for seed-local."""
    cmd_seed_local(ctx)


def main() -> None:
    app()


if __name__ == "__main__":
    main()

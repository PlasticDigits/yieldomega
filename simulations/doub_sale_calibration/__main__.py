# SPDX-License-Identifier: AGPL-3.0-or-later
"""CLI: print calibration tables and optional PNG charts (matplotlib)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from doub_sale_calibration.core import (
    clearing_cl8y_per_doub,
    cumulative_mint_under_k,
    doub_per_charm_from_k,
    implied_launch_price_usd_per_doub,
    k_doub_per_cl8y,
    linear_raise_profile,
    price_path_samples,
    referral_charm_weight_denominator_multiplier,
    sale_tranche_notional_usd,
)


def _fmt(x: float, nd: int = 6) -> str:
    return f"{x:.{nd}g}"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="DOUB sale calibration: $500k FDV @ 250M-style anchor, k DOUB/CL8Y, referral sensitivity."
    )
    p.add_argument("--fdv-usd", type=float, default=500_000.0, help="Fully diluted valuation anchor (USD)")
    p.add_argument(
        "--total-supply-tokens",
        type=float,
        default=250_000_000.0,
        help="Genesis DOUB denominator for FDV (whole tokens)",
    )
    p.add_argument(
        "--sale-tokens",
        type=float,
        default=200_000_000.0,
        help="TimeCurve sale bucket (whole DOUB; v1 totalTokensForSale)",
    )
    p.add_argument(
        "--total-raise-cl8y",
        type=float,
        default=1_000_000.0,
        help="Modeled or observed total gross CL8Y raised over the sale (human units)",
    )
    p.add_argument("--cl8y-usd", type=float, default=1.0, help="CL8Y USD mark for sanity lines")
    p.add_argument(
        "--sale-duration-days",
        type=float,
        default=30.0,
        help="Synthetic horizon for chart series (days)",
    )
    p.add_argument(
        "--base-price-wad",
        type=int,
        default=10**17,
        help="LinearCharmPrice basePriceWad (example: 1e17 = 0.1 CL8Y per 1e18 CHARM)",
    )
    p.add_argument("--daily-increment-wad", type=int, default=10**16, help="LinearCharmPrice dailyIncrementWad")
    p.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="If set, write PNG charts here (requires matplotlib)",
    )
    p.add_argument("--steps", type=int, default=200, help="Samples along synthetic time axis")
    args = p.parse_args(argv)

    launch_p = implied_launch_price_usd_per_doub(
        fdv_usd=args.fdv_usd, total_supply_tokens=args.total_supply_tokens
    )
    sale_notional = sale_tranche_notional_usd(
        launch_price_usd_per_doub=launch_p, sale_tokens=args.sale_tokens
    )
    k = k_doub_per_cl8y(sale_tokens=args.sale_tokens, total_raise_cl8y=args.total_raise_cl8y)
    cl8y_per_doub = clearing_cl8y_per_doub(
        total_raise_cl8y=args.total_raise_cl8y, sale_tokens=args.sale_tokens
    )
    clearing_usd = cl8y_per_doub * args.cl8y_usd

    print("=== DOUB genesis / sale calibration (planning) ===")
    print(f"FDV anchor (USD):           {_fmt(args.fdv_usd)}")
    print(f"Genesis supply (tokens):    {_fmt(args.total_supply_tokens)}")
    print(f"Implied launch USD/DOUB:    {_fmt(launch_p)}")
    print(f"Sale bucket (DOUB):         {_fmt(args.sale_tokens)}")
    print(f"Sale tranche USD @ anchor:  {_fmt(sale_notional)}")
    print(f"Modeled gross raise (CL8Y): {_fmt(args.total_raise_cl8y)}")
    print(f"Target k (DOUB per CL8Y):   {_fmt(k)}")
    print(f"Avg clearing CL8Y/DOUB:     {_fmt(cl8y_per_doub)}")
    print(f"Avg clearing USD/DOUB @mark:{_fmt(clearing_usd)} (CL8Y={args.cl8y_usd} USD)")
    print(
        "FDV definition: fully diluted launch mark = FDV / genesis supply "
        "(all 250M buckets at the same reference price unless separately documented)."
    )
    print()
    print("Referral sensitivity (canonical 5% + 5% CHARM weight per referred buy):")
    print("  frac_referred  charmDenomMult  note")
    for frac in (0.0, 0.5, 0.8, 1.0):
        m = referral_charm_weight_denominator_multiplier(fraction_of_raise_from_referred_buys=frac)
        print(f"  {frac:4.1f}           {m:.4f}           totalCharmWeight / rawCharm ≈ {m:.4f} if uniform mix")
    print()
    print(
        "v1 onchain: fixed `totalTokensForSale` pre-funded; `redeemCharms` is pro-rata on `totalCharmWeight`. "
        "Mintable k above is a deploy/planning target if governance moves to per-CL8Y minting."
    )

    if args.out_dir is None:
        return 0

    try:
        import matplotlib.pyplot as plt
    except ImportError:
        print(
            "matplotlib not installed; install extras: cd simulations && pip install -e '.[charts]'",
            file=sys.stderr,
        )
        return 1

    args.out_dir.mkdir(parents=True, exist_ok=True)
    duration_sec = args.sale_duration_days * 86400.0
    t_raised, cum_raise = linear_raise_profile(
        duration_sec=duration_sec, total_raise_cl8y=args.total_raise_cl8y, steps=args.steps
    )
    cum_doub = [cumulative_mint_under_k(r, k_doub_per_cl8y=k) for r in cum_raise]

    fig1, ax1 = plt.subplots(figsize=(8, 4))
    ax1.plot([x / 86400.0 for x in t_raised], cum_doub, label="Cumulative DOUB (k × raise)")
    ax1.set_xlabel("Synthetic sale time (days)")
    ax1.set_ylabel("DOUB (human units)")
    ax1.set_title("Mint-under-k schedule (linear raise profile)")
    ax1.grid(True, alpha=0.3)
    ax1.legend()
    fig1.savefig(args.out_dir / "doub_cumulative_mint_vs_time.png", dpi=120, bbox_inches="tight")
    plt.close(fig1)

    fig2, ax2 = plt.subplots(figsize=(8, 4))
    ax2.plot([x / 86400.0 for x in t_raised], cum_raise, color="C1")
    ax2.set_xlabel("Synthetic sale time (days)")
    ax2.set_ylabel("Cumulative CL8Y raised")
    ax2.set_title("Synthetic CL8Y raise (linear)")
    ax2.grid(True, alpha=0.3)
    fig2.savefig(args.out_dir / "cl8y_cumulative_raise.png", dpi=120, bbox_inches="tight")
    plt.close(fig2)

    t_price, wad_price = price_path_samples(
        duration_sec=duration_sec,
        base_wad=args.base_price_wad,
        daily_increment_wad=args.daily_increment_wad,
        steps=args.steps,
    )
    # Interpret priceWad as CL8Y per 1e18 CHARM for plotting.
    dpc = [doub_per_charm_from_k(k_doub_per_cl8y=k, price_cl8y_per_charm=w / float(10**18)) for w in wad_price]
    fig3, ax3 = plt.subplots(figsize=(8, 4))
    ax3.plot([x / 86400.0 for x in t_price], dpc)
    ax3.set_xlabel("Elapsed sale time (days)")
    ax3.set_ylabel("k × price: implied DOUB per CHARM (float)")
    ax3.set_title("Effective DOUB per CHARM along LinearCharmPrice path (planning)")
    ax3.grid(True, alpha=0.3)
    fig3.savefig(args.out_dir / "doub_per_charm_vs_time.png", dpi=120, bbox_inches="tight")
    plt.close(fig3)

    fracs = [i / 100 for i in range(0, 101, 5)]
    mults = [referral_charm_weight_denominator_multiplier(fraction_of_raise_from_referred_buys=f) for f in fracs]
    fig4, ax4 = plt.subplots(figsize=(8, 4))
    ax4.plot(fracs, mults)
    ax4.set_xlabel("Fraction of volume with referral applied (scenario)")
    ax4.set_ylabel("Approx totalCharmWeight / sum(charmWad)")
    ax4.set_title("Referral sensitivity (canonical 5% + 5% CHARM weight)")
    ax4.grid(True, alpha=0.3)
    fig4.savefig(args.out_dir / "referral_charm_denominator_mult.png", dpi=120, bbox_inches="tight")
    plt.close(fig4)

    print(f"Wrote charts under {args.out_dir.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

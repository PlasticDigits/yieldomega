"""SVG charts for `raise_milestone_sim` JSON report (no matplotlib required)."""

from __future__ import annotations

import math
from pathlib import Path
from typing import Any


def _scale_y(v: float, vmin: float, vmax: float, plot_h: float, pad: float = 8.0) -> float:
    if vmax <= vmin + 1e-18:
        return plot_h / 2.0
    t = (v - vmin) / (vmax - vmin)
    return pad + (1.0 - t) * (plot_h - 2 * pad)


def _scale_x(day_idx: int, n: int, plot_w: float, pad: float = 40.0) -> float:
    """day_idx 0..n-1 -> x"""
    if n <= 1:
        return pad + plot_w / 2
    return pad + (day_idx / (n - 1)) * (plot_w - 2 * pad)


def render_raise_curve_chart(report: dict[str, Any], out_path: Path, *, scenario_name: str = "medium") -> None:
    scenarios = report.get("scenarios") or []
    sc = next((s for s in scenarios if s.get("scenario") == scenario_name), None)
    if sc is None:
        sc = scenarios[0] if scenarios else None
    if sc is None:
        raise ValueError("No scenarios in report")

    days = int(report.get("chart_days") or 30)
    per = sc.get("per_sim_day_index_1_based") or {}
    dmin = per.get("daily_spend_min") or [0.0] * days
    dmax = per.get("daily_spend_max") or [0.0] * days
    dmean = per.get("daily_spend_mean") or [0.0] * days
    cmin = per.get("cum_raise_min") or [0.0] * days
    cmax = per.get("cum_raise_max") or [0.0] * days
    cmean = per.get("cum_raise_mean") or [0.0] * days
    samples = sc.get("sample_runs_for_charts") or []

    W, H = 900, 520
    pw, ph = W - 80, 200

    def panel_svg(
        title: str,
        ymin: float,
        ymax: float,
        mean_vals: list[float],
        min_vals: list[float],
        max_vals: list[float],
        y_label: str,
        y_offset: float,
        sample_key: str,
    ) -> str:
        parts: list[str] = []
        y0 = y_offset
        parts.append(f'<text x="40" y="{y0 + 18}" font-family="system-ui,sans-serif" font-size="14" font-weight="600">{title}</text>')

        # min-max band as polygon
        pts_upper = []
        pts_lower = []
        for i in range(days):
            x = _scale_x(i, days, pw)
            pts_upper.append(f"{x:.1f},{y0 + 40 + _scale_y(max_vals[i], ymin, ymax, ph)}")
            pts_lower.insert(0, f"{x:.1f},{y0 + 40 + _scale_y(min_vals[i], ymin, ymax, ph)}")
        poly = " ".join(pts_upper + pts_lower)
        parts.append(
            f'<polygon points="{poly}" fill="#94a3b8" fill-opacity="0.25" stroke="none"/>'
        )

        # mean line
        d_mean = "M " + " L ".join(
            f"{_scale_x(i, days, pw):.1f},{y0 + 40 + _scale_y(mean_vals[i], ymin, ymax, ph):.1f}"
            for i in range(days)
        )
        parts.append(f'<path d="{d_mean}" fill="none" stroke="#0f172a" stroke-width="2"/>')

        palette = ("#dc2626", "#ea580c", "#ca8a04", "#16a34a", "#0891b2", "#2563eb", "#7c3aed", "#db2777", "#64748b", "#78716c")
        for si, s in enumerate(samples[:10]):
            raw = s.get(sample_key) or []
            if len(raw) < days:
                raw = list(raw) + [raw[-1] if raw else 0.0] * (days - len(raw))
            d_s = "M " + " L ".join(
                f"{_scale_x(i, days, pw):.1f},{y0 + 40 + _scale_y(float(raw[i]), ymin, ymax, ph):.1f}"
                for i in range(days)
            )
            parts.append(
                f'<path d="{d_s}" fill="none" stroke="{palette[si % len(palette)]}" stroke-width="1.2" stroke-opacity="0.55" stroke-dasharray="4 3"/>'
            )

        parts.append(
            f'<text x="24" y="{y0 + 40 + ph/2}" font-family="system-ui,sans-serif" font-size="11" fill="#475569" transform="rotate(-90 24 {y0 + 40 + ph/2})">{y_label}</text>'
        )
        parts.append(
            f'<text x="{40 + pw/2 - 60}" y="{y0 + 40 + ph + 28}" font-family="system-ui,sans-serif" font-size="11" fill="#64748b">Sim day (1–{days})</text>'
        )
        return "\n".join(parts)

    d_ymax = max(max(dmax) if dmax else 0, max(dmean) if dmean else 0, 1.0)
    d_ymin = 0.0

    c_ymax = max(max(cmax) if cmax else 0, max(cmean) if cmean else 0, 1.0)
    c_ymin = 0.0

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        f'<rect width="{W}" height="{H}" fill="#fafafa"/>',
        f'<text x="{W/2 - 200}" y="28" font-family="system-ui,sans-serif" font-size="15" font-weight="600">'
        f'TimeCurve — {sc.get("scenario", "?")} (λ={sc.get("arrival_rate")}, budget×{sc.get("budget_scale")})</text>',
        panel_svg(
            "Daily spend (first 30 sim days)",
            d_ymin,
            d_ymax * 1.05,
            dmean,
            dmin,
            dmax,
            "USDm / day",
            36,
            "daily_spend",
        ),
        panel_svg(
            "Cumulative raise at end of each sim day",
            c_ymin,
            c_ymax * 1.05,
            cmean,
            cmin,
            cmax,
            "USDm cumulative",
            276,
            "cum_end_day",
        ),
        '<text x="40" y="505" font-family="system-ui,sans-serif" font-size="10" fill="#94a3b8">'
        "Shaded band = min–max across seeds; black = mean; dashed = 10 sample runs.</text>",
        "</svg>",
    ]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(svg_parts), encoding="utf-8")


def render_raise_curve_chart_png_if_available(report: dict[str, Any], out_path: Path, *, scenario_name: str = "medium") -> None:
    """Optional matplotlib PNG; falls back to SVG sibling path."""
    try:
        import matplotlib

        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except ImportError:
        svg_path = out_path.with_suffix(".svg")
        render_raise_curve_chart(report, svg_path, scenario_name=scenario_name)
        return

    scenarios = report.get("scenarios") or []
    sc = next((s for s in scenarios if s.get("scenario") == scenario_name), None) or (scenarios[0] if scenarios else None)
    if sc is None:
        raise ValueError("No scenarios in report")
    days = int(report.get("chart_days") or 30)
    x = np.arange(1, days + 1)
    per = sc.get("per_sim_day_index_1_based") or {}
    dmin = np.array(per.get("daily_spend_min") or [0.0] * days)
    dmax = np.array(per.get("daily_spend_max") or [0.0] * days)
    dmean = np.array(per.get("daily_spend_mean") or [0.0] * days)
    cmin = np.array(per.get("cum_raise_min") or [0.0] * days)
    cmax = np.array(per.get("cum_raise_max") or [0.0] * days)
    cmean = np.array(per.get("cum_raise_mean") or [0.0] * days)
    samples = sc.get("sample_runs_for_charts") or []

    fig, (ax0, ax1) = plt.subplots(2, 1, figsize=(11, 8), sharex=True)
    title = f"TimeCurve sim — {sc.get('scenario', '?')} (λ={sc.get('arrival_rate')}, budget×{sc.get('budget_scale')})"
    fig.suptitle(title, fontsize=12)
    ax0.fill_between(x, dmin, dmax, alpha=0.25, color="#6366f1", label="Min–max across seeds")
    ax0.plot(x, dmean, color="#0f172a", linewidth=2.0, label="Mean daily spend")
    colors = plt.cm.tab10(np.linspace(0, 0.9, min(10, len(samples))))
    for i, s in enumerate(samples[:10]):
        ds = s.get("daily_spend") or []
        if len(ds) < days:
            ds = list(ds) + [0.0] * (days - len(ds))
        ax0.plot(x, ds[:days], color=colors[i], alpha=0.45, linewidth=1.0, linestyle="--")
    ax0.set_ylabel("Daily spend (USDm)")
    ax0.legend(loc="upper right", fontsize=8)
    ax0.grid(True, alpha=0.3)
    ax0.set_title("Daily spend (first 30 sim days)")
    ax1.fill_between(x, cmin, cmax, alpha=0.25, color="#22c55e", label="Min–max across seeds")
    ax1.plot(x, cmean, color="#0f172a", linewidth=2.0, label="Mean cumulative raise")
    for i, s in enumerate(samples[:10]):
        cs = s.get("cum_end_day") or []
        if len(cs) < days:
            cs = list(cs) + [cs[-1] if cs else 0.0] * (days - len(cs))
        ax1.plot(x, cs[:days], color=colors[i], alpha=0.45, linewidth=1.0, linestyle="--")
    ax1.set_ylabel("Cumulative raise (USDm)")
    ax1.set_xlabel("Sim day (1 = first 24h)")
    ax1.legend(loc="lower right", fontsize=8)
    ax1.grid(True, alpha=0.3)
    ax1.set_title("Cumulative raise at end of each sim day")
    fig.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)

# SPDX-License-Identifier: AGPL-3.0-only
"""Reference SFX — tuned to a warm, brassy, coin/forest + jig-adjacent palette."""

from __future__ import annotations

import numpy as np

from sfx_synth import (
    Adsr,
    biquad_bandpass,
    fm_bell,
    highpass_1,
    normalizePeak,
    sin_hz,
    soft_clip,
    t_samples,
    white_noise,
    DEFAULT_SR,
)

SR = DEFAULT_SR
RNG = np.random.default_rng(42)
PI2 = 2.0 * np.pi


def _click_short(rng: np.random.Generator, duration: float) -> np.ndarray:
    n = int(duration * SR)
    nse = highpass_1(white_noise(n, rng) * 0.8, 800.0, SR)
    env = Adsr(0.001, 0.0, 1.0, 0.01).envelope(n, SR)
    return nse * env * 0.4


def ui_button_click() -> np.ndarray:
    """Tight, slightly woody tick — "counter / tavern" more than a glassy UI beep."""
    n = int(0.06 * SR)
    t = t_samples(n, SR)
    body = np.sin(PI2 * 1200.0 * t) * (1.0 - 0.7 * t * 20.0)
    cshort = _click_short(RNG, 0.02)
    cpad = np.zeros(n, dtype=np.float64)
    cpad[: cshort.shape[0]] = cshort
    tick = biquad_bandpass(
        cpad * 0.3 + white_noise(n, RNG) * 0.1, 2400, 0.5, SR
    )
    env = Adsr(0.0, 0.002, 0.7, 0.015).envelope(n, SR)
    return normalizePeak(soft_clip((body + tick) * env * 0.5))


def coin_hit_shallow() -> np.ndarray:
    """CL8Y / "doubloon" — two-part bright strike (maps to *Hills at Dawn* / *Coin Path*)."""
    n = int(0.32 * SR)
    t = t_samples(n, SR)
    a = np.exp(-t * 18) * (np.sin(PI2 * 1820.0 * t) + 0.45 * np.sin(PI2 * 2870.0 * t + 0.2))
    b = fm_bell(t, 2400, 0.5, 2.5, 0.12) * np.exp(-t * 14)
    env = Adsr(0.0, 0.02, 0.0, 0.18).envelope(n, SR)
    return normalizePeak(highpass_1(soft_clip((a + b) * env * 0.4), 120, SR))


def charmed_confirm() -> np.ndarray:
    """Rising 5th — *Lucky Run* / charm stamp feeling."""
    n = int(0.45 * SR)
    t = t_samples(n, SR)
    m1 = (t < 0.2) * (np.exp(-2.0 * t) * np.sin(PI2 * 440.0 * t))
    m2 = (t >= 0.1) * (np.exp(-2.3 * (t - 0.1)) * np.sin(PI2 * 660.0 * t))
    br = 0.12 * biquad_bandpass(white_noise(n, RNG), 2000, 0.4, SR) * np.exp(-t * 6)
    env = Adsr(0.01, 0.05, 0.0, 0.2).envelope(n, SR)
    return normalizePeak(soft_clip((m1 + m2 + br) * env * 0.5))


def peer_buy_distant() -> np.ndarray:
    """Another wallet buy — same coin family, softer, slightly filtered ("down the path")."""
    c = coin_hit_shallow() * 0.55
    n = c.shape[0]
    t = t_samples(n, SR)
    air = 0.2 * np.exp(-t * 4) * np.sin(PI2 * 500.0 * t)
    filtered = biquad_bandpass(soft_clip(c * 0.4 + air), 900, 0.35, SR)
    return normalizePeak(filtered * Adsr(0, 0, 0.6, 0.05).envelope(n, SR))


def timer_heartbeat(urgent: bool = False) -> np.ndarray:
    """Pulsing tick — sped + brighter when `urgent` (low timer on TimeCurve)."""
    dur = 0.2 if not urgent else 0.12
    n = int(dur * SR)
    t = t_samples(n, SR)
    f0 = 220.0 if not urgent else 300.0
    body = biquad_bandpass(sin_hz(f0, t) * np.exp(-t * 11), f0, 0.4, SR)
    nse = 0.08 * biquad_bandpass(white_noise(n, RNG), 2000, 0.2, SR)
    env = Adsr(0.0, 0.01, 0.0, 0.08 if not urgent else 0.05).envelope(n, SR)
    return normalizePeak(soft_clip((body + nse) * env * 0.5))


def warbow_twang() -> np.ndarray:
    """Plucked, slightly resonant — ladder / bow (WarBow) without being literal archery foley."""
    n = int(0.4 * SR)
    t = t_samples(n, SR)
    f = 165.0
    plk = np.sin(PI2 * f * t) * (1.0 - 0.2 * t) * np.exp(-1.4 * t)
    br = 0.2 * biquad_bandpass(white_noise(n, RNG), 700, 0.25, SR) * np.exp(-6.0 * t)
    env = Adsr(0.0, 0.05, 0.0, 0.15).envelope(n, SR)
    return normalizePeak(soft_clip((plk + br) * env))


def kumbaya_whoosh() -> np.ndarray:
    """Soft air / route motion — *Kumbaya Campfire*-adjacent (no literal guitar)."""
    n = int(0.55 * SR)
    t = t_samples(n, SR)
    s = 0.7 * biquad_bandpass(white_noise(n, RNG), 1200, 0.2, SR)
    s = s * (np.tanh(8.0 * (1.0 - np.exp(-(t * 1.2))))) * np.exp(-(t * 0.2))
    s = s * Adsr(0.1, 0, 0.0, 0.25).envelope(n, SR)
    s = s + 0.15 * biquad_bandpass(white_noise(n, RNG), 400, 0.1, SR) * np.exp(-(t * 0.2))
    return normalizePeak(highpass_1(soft_clip(s * 0.3), 80, SR))

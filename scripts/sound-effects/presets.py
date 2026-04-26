# SPDX-License-Identifier: AGPL-3.0-only
"""Reference SFX — warm, thumpy, low-mid weight; not glassy/telecom beeps."""

from __future__ import annotations

import numpy as np

from sfx_synth import (
    Adsr,
    biquad_bandpass,
    highpass_1,
    lowpass_1,
    normalizePeak,
    sin_hz,
    soft_clip,
    soft_tone,
    t_samples,
    white_noise,
    DEFAULT_SR,
)

SR = DEFAULT_SR
RNG = np.random.default_rng(42)
PI2 = 2.0 * np.pi


def _dull_tap(n: int, t: np.ndarray, rng: np.random.Generator, center: float) -> np.ndarray:
    nse = biquad_bandpass(white_noise(n, rng), center, 0.32, SR)
    return nse * np.exp(-(t * 1.0e3 / max(center, 1.0)) * 1.1)


def ui_button_click() -> np.ndarray:
    """Soft felt / wood block — no 1+ kHz sine ping."""
    n = int(0.08 * SR)
    t = t_samples(n, SR)
    nse = 0.65 * biquad_bandpass(white_noise(n, RNG), 520, 0.32, SR)
    nse += 0.2 * biquad_bandpass(white_noise(n, RNG), 140, 0.2, SR)
    body = 0.18 * np.sin(PI2 * 380.0 * t) * (1.0 - t * 12.0)
    nse = (nse + body) * Adsr(0.001, 0.004, 0.0, 0.022).envelope(n, SR)
    x = lowpass_1(soft_clip(nse * 0.6), 2400, SR)
    return normalizePeak(x)


def coin_hit_shallow() -> np.ndarray:
    """Metal pocket coin — body in 600–1200 Hz, not FM chime, no 2.5 kHz bell."""
    n = int(0.34 * SR)
    t = t_samples(n, SR)
    strike = 0.55 * soft_tone(
        t, [640.0, 950.0, 1180.0], [0.45, 0.28, 0.12], [4.0, -6.0, 3.0], 11.0
    )
    grain = 0.22 * _dull_tap(n, t, RNG, 880.0) * Adsr(0, 0.0, 1.0, 0.0).envelope(
        n, SR
    )
    genv = np.exp(-t * 5.0)
    strike = (strike + grain) * genv
    x = biquad_bandpass(strike, 820.0, 0.4, SR)
    x = lowpass_1(soft_clip(x * Adsr(0, 0.01, 0.0, 0.2).envelope(n, SR)), 4200, SR)
    x = highpass_1(x, 100, SR)
    return normalizePeak(x)


def charmed_confirm() -> np.ndarray:
    """Low, chordal 'stamp' — detuned mid tones, LPF (no 440+660 pure 5th beep)."""
    n = int(0.48 * SR)
    t = t_samples(n, SR)
    m1 = 0.55 * soft_tone(
        t, [195.0, 247.0, 330.0], [0.35, 0.3, 0.22], [0.0, 5.0, -3.0], 2.6
    )
    m1 *= (t < 0.22) * 1.0
    m2 = 0.4 * soft_tone(
        t - 0.1,
        [247.0, 311.0, 370.0],
        [0.3, 0.22, 0.15],
        [-2.0, 4.0, -1.0],
        2.2,
    )
    m2 *= (t >= 0.1) * 1.0
    air = 0.1 * biquad_bandpass(white_noise(n, RNG), 420.0, 0.3, SR) * np.exp(-t * 3.5)
    s = m1 + m2 + air
    env = Adsr(0.03, 0.08, 0.0, 0.22).envelope(n, SR)
    s = s * env
    x = lowpass_1(soft_clip(s * 0.55), 2000, SR)
    return normalizePeak(biquad_bandpass(x, 500.0, 0.25, SR) * 0.85 + x * 0.15)


def peer_buy_distant() -> np.ndarray:
    """Distant coin: same as hit + heavy air, mud EQ."""
    c = coin_hit_shallow() * 0.5
    n = c.shape[0]
    t = t_samples(n, SR)
    air = 0.3 * biquad_bandpass(white_noise(n, RNG), 280.0, 0.25, SR) * np.exp(-t * 2.5)
    s = c * 0.5 + air
    s = biquad_bandpass(s, 500.0, 0.28, SR)
    s = lowpass_1(soft_clip(s * Adsr(0, 0, 0.65, 0.06).envelope(n, SR)), 2000, SR)
    return normalizePeak(s)


def timer_heartbeat(urgent: bool = False) -> np.ndarray:
    """Low thump, not 220/300 Hz beep. Noise + sub bump."""
    dur = 0.2 if not urgent else 0.12
    n = int(dur * SR)
    t = t_samples(n, SR)
    f0 = 98.0 if not urgent else 120.0
    sub = 0.35 * np.sin(PI2 * f0 * t) * (1.0 - t * 4.0) * (t < 0.08) * 1.0
    wsh = 0.45 * biquad_bandpass(white_noise(n, RNG), 200.0, 0.2, SR)
    wsh *= np.exp(-(t * (75.0 if not urgent else 100.0)))
    x = (sub + wsh) * Adsr(0.0, 0.02, 0.0, 0.08 if not urgent else 0.05).envelope(
        n, SR
    )
    x = lowpass_1(soft_clip(x * 0.6), 900, SR)
    return normalizePeak(x)


def warbow_twang() -> np.ndarray:
    """Pluck with slight bend down — inharmonic partials, LPF, not pure 165 Hz beep."""
    n = int(0.45 * SR)
    t = t_samples(n, SR)
    f0 = 88.0
    bend = 1.0 - 0.06 * t * 2.0
    ph = 2.0 * np.cumsum(f0 * bend) / SR * PI2
    plk = 0.55 * np.sin(ph) * np.exp(-1.0 * t)
    plk += 0.15 * np.sin(2.0 * ph) * np.exp(-2.5 * t) + 0.08 * np.sin(3.0 * ph) * np.exp(-3.0 * t)
    wood = 0.18 * biquad_bandpass(white_noise(n, RNG), 420.0, 0.22, SR) * np.exp(-5.0 * t)
    x = (plk + wood) * Adsr(0.0, 0.06, 0.0, 0.18).envelope(n, SR)
    return normalizePeak(lowpass_1(soft_clip(x * 0.5), 2200, SR))


def kumbaya_whoosh() -> np.ndarray:
    """Mostly sub / low-mid air, not 1.2 kHz filtered hiss."""
    n = int(0.55 * SR)
    t = t_samples(n, SR)
    s1 = 0.55 * biquad_bandpass(white_noise(n, RNG), 360.0, 0.18, SR)
    s2 = 0.3 * biquad_bandpass(white_noise(n, RNG), 720.0, 0.2, SR)
    env = (np.tanh(6.0 * (1.0 - np.exp(-(t * 1.0))))) * np.exp(-(t * 0.12))
    s = (s1 * 0.6 + s2 * 0.4) * env
    s = s * Adsr(0.12, 0, 0.0, 0.3).envelope(n, SR)
    x = lowpass_1(soft_clip(s * 0.35), 2000, SR)
    return normalizePeak(highpass_1(x, 60, SR))

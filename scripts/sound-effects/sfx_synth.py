# SPDX-License-Identifier: AGPL-3.0-only
"""
Small procedural SFX utilities: oscillators, noise, ADSR, FM, and WAV export.

Intended for iterating on game/UI sounds without a DAW; output is
frontend-friendly mono 16-bit PCM.
"""

from __future__ import annotations

import wave
from dataclasses import dataclass
from pathlib import Path
import numpy as np

DEFAULT_SR = 44_100
TWO_PI = 2.0 * np.pi


@dataclass(frozen=True)
class Adsr:
    """Seconds for attack, decay, sustain level 0..1, release — classic ADSR on total length."""

    a: float
    d: float
    s: float
    r: float

    def envelope(self, n_samples: int, sr: int) -> np.ndarray:
        a_n = max(1, int(self.a * sr))
        d_n = max(0, int(self.d * sr))
        r_n = max(0, int(self.r * sr))
        sustain_n = max(0, n_samples - a_n - d_n - r_n)
        t = np.arange(n_samples, dtype=np.float64)
        env = np.zeros(n_samples, dtype=np.float64)
        a_end = a_n
        d_end = a_n + d_n
        s_start = a_n + d_n
        s_end = s_start + sustain_n
        r_start = s_end
        r_end = n_samples

        env[:a_end] = t[:a_end] / a_n
        if d_n > 0 and d_end > a_end:
            d_slice = t[a_end:d_end] - a_end
            env[a_end:d_end] = 1.0 - (1.0 - self.s) * (d_slice / d_n)
        if sustain_n > 0 and s_end > s_start:
            env[s_start:s_end] = self.s
        if r_n > 0 and r_end > r_start:
            r_slice = t[r_start:r_end] - r_start
            env[r_start:r_end] = self.s * (1.0 - r_slice / r_n)
        if r_n == 0 and r_start < n_samples:
            env[r_start:] = 0.0
        return np.clip(env, 0.0, 1.0)


def t_samples(n: int, sr: int) -> np.ndarray:
    return np.arange(n, dtype=np.float64) / sr


def white_noise(n: int, rng: np.random.Generator | None = None) -> np.ndarray:
    g = rng or np.random.default_rng(0)
    return g.uniform(-1.0, 1.0, n).astype(np.float64)


def soft_clip(x: np.ndarray) -> np.ndarray:
    return np.tanh(1.2 * x)


def sin_hz(freq: np.ndarray | float, t: np.ndarray) -> np.ndarray:
    f = np.asarray(freq, dtype=np.float64)
    if f.shape == ():
        return np.sin(TWO_PI * f * t)
    return np.sin(TWO_PI * f * t)


def fm_bell(
    t: np.ndarray, carrier: float, ratio: float, mod_index: float, t_decay: float
) -> np.ndarray:
    mod = mod_index * np.exp(-t / t_decay) * np.sin(TWO_PI * (carrier * ratio) * t)
    return np.sin(TWO_PI * carrier * t + mod)


def biquad_bandpass(x: np.ndarray, center_hz: float, q: float, sr: int) -> np.ndarray:
    """
    2nd-order biquad bandpass (RBJ cookbook), Direct Form I.
    """
    w0 = TWO_PI * (center_hz / sr)
    alpha = np.sin(w0) / (2.0 * max(q, 0.1))
    b0 = alpha
    b1 = 0.0
    b2 = -alpha
    a0 = 1.0 + alpha
    a1 = -2.0 * np.cos(w0)
    a2 = 1.0 - alpha
    b0 /= a0
    b1 /= a0
    b2 /= a0
    a1 /= a0
    a2 /= a0
    n = x.shape[0]
    y = np.zeros(n, dtype=np.float64)
    x1 = x2 = y1 = y2 = 0.0
    for i in range(n):
        x0 = x[i]
        y0 = b0 * x0 + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        y[i] = y0
        x2, x1 = x1, x0
        y2, y1 = y1, y0
    return y


def highpass_1(x: np.ndarray, cutoff: float, sr: int) -> np.ndarray:
    """One-pole high-pass (DC / rumble clean-up)."""
    r = np.exp(-TWO_PI * cutoff / sr)
    y = np.zeros_like(x)
    prev_x = 0.0
    prev_y = 0.0
    for i in range(x.shape[0]):
        y[i] = r * (prev_y + x[i] - prev_x)
        prev_x = x[i]
        prev_y = y[i]
    return y


def normalizePeak(x: np.ndarray, target: float = 0.92) -> np.ndarray:
    p = float(np.max(np.abs(x)) + 1e-9)
    return (x / p) * target


def mix(*tracks: np.ndarray) -> np.ndarray:
    s = sum(tracks) if tracks else np.array([], dtype=np.float64)
    return soft_clip(s * 0.5)


def save_wav_mono16(path: Path, samples: np.ndarray, sr: int) -> None:
    """
    `samples` is float mono [-1, 1] written as int16 PCM.
    """
    path = path.resolve()
    path.parent.mkdir(parents=True, exist_ok=True)
    x = np.clip(samples, -1.0, 1.0)
    pcm = (x * 32767.0).astype(np.int16)
    with wave.open(str(path), "w") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(pcm.tobytes())

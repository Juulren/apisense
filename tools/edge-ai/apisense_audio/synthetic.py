"""Synthetic hive-like audio, ONLY for tests and demos of the pipeline.

It is not evidence about real hives: real recordings (phase 0 of the plan) are
what the baseline has to be judged on. The disturbances here are generic
spectral shapes used to check that the detector reacts to *something* different.
"""
from __future__ import annotations

import numpy as np

from .features import SAMPLE_RATE, window_features


def synthetic_audio(seconds: float, rng: np.random.Generator, hour: float = 12.0,
                    anomaly: str | None = None, sr: int = SAMPLE_RATE) -> np.ndarray:
    n = int(seconds * sr)
    t = np.arange(n) / sr
    day_level = 0.6 + 0.4 * np.sin(np.pi * (hour - 6) / 12) ** 2 if 6 <= hour <= 18 else 0.5
    hum = 0.04 * day_level
    x = hum * np.sin(2 * np.pi * 125 * t) + 0.5 * hum * np.sin(2 * np.pi * 250 * t + 0.7)
    x += 0.004 * day_level * rng.standard_normal(n)  # background
    x += 0.012 * day_level * np.convolve(rng.standard_normal(n), np.ones(8) / 8, mode="same")  # forager flutter
    if anomaly == "tooting":
        x += 0.05 * np.sin(2 * np.pi * 400 * t) * (np.sin(2 * np.pi * 3 * t) > 0)
    elif anomaly == "broadband":
        x += 0.03 * rng.standard_normal(n)
    elif anomaly == "warble":
        x += 0.05 * np.sin(2 * np.pi * (255 + 30 * np.sin(2 * np.pi * 2 * t)) * t)
    return x.astype(np.float64)


def synthetic_windows(days: int, per_day: int, rng: np.random.Generator, window_seconds: float = 4.0,
                      events: list[tuple[int, int, str]] | None = None):
    """Feature windows for `days` days. `events` are (start, end, kind) window indexes (inclusive).
    Returns (windows, hours, day_index)."""
    events = events or []
    rows, hours, day = [], [], []
    for i in range(days * per_day):
        hour = (i % per_day) * 24.0 / per_day
        kind = next((k for s, e, k in events if s <= i <= e), None)
        rows.append(window_features(synthetic_audio(window_seconds, rng, hour, kind)))
        hours.append(hour)
        day.append(i // per_day)
    return np.array(rows), np.array(hours), np.array(day)

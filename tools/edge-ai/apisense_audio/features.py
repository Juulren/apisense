"""Acoustic features for hive audio, simple enough to port to the ESP32.

Everything is plain FFT band energy in dB, no learned filters, so the same
numbers can be computed in C++ on the node and compared with the PC.

A *window* (default 60 s) is summarised by the mean and spread (std) of the
frame features inside it. Frames are 1024 samples (64 ms at 16 kHz) with 50 %
overlap and a Hann window.
"""
from __future__ import annotations

import numpy as np

SAMPLE_RATE = 16_000
FRAME = 1024
HOP = 512
# Bands cover what the literature reports for hives (about 100-500 Hz for the
# colony hum, tooting near 400 Hz) plus broadband content up to 8 kHz.
BANDS_HZ = [
    (20, 100),
    (100, 200),
    (200, 300),
    (300, 450),
    (450, 700),
    (700, 1500),
    (1500, 4000),
    (4000, 8000),
]
FRAME_FEATURES = (
    [f"band_{lo}_{hi}_db" for lo, hi in BANDS_HZ]
    + ["rms_db", "centroid_hz", "dominant_hz", "flatness"]
)
FEATURE_NAMES = [f"{n}_{s}" for n in FRAME_FEATURES for s in ("mean", "std")]
_EPS = 1e-12


def _frames(signal: np.ndarray) -> np.ndarray:
    if signal.size < FRAME:
        signal = np.pad(signal, (0, FRAME - signal.size))
    count = 1 + (signal.size - FRAME) // HOP
    index = np.arange(FRAME)[None, :] + HOP * np.arange(count)[:, None]
    return signal[index]


def frame_features(signal, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    """Per-frame features, shape (frames, len(FRAME_FEATURES))."""
    source = np.asarray(signal)
    x = source.astype(np.float64)
    if source.dtype.kind in "iu":
        x = x / 32768.0  # integer PCM -> [-1, 1); float input is taken as already normalised
    raw = _frames(x)
    frames = raw * np.hanning(FRAME)[None, :]
    power = np.abs(np.fft.rfft(frames, axis=1)) ** 2 / FRAME
    freqs = np.fft.rfftfreq(FRAME, 1.0 / sample_rate)
    cols = []
    for lo, hi in BANDS_HZ:
        mask = (freqs >= lo) & (freqs < hi)
        cols.append(10 * np.log10(power[:, mask].sum(axis=1) + _EPS))
    total = power.sum(axis=1) + _EPS
    cols.append(10 * np.log10(np.mean(raw**2, axis=1) + _EPS))
    cols.append((power * freqs[None, :]).sum(axis=1) / total)
    hum = (freqs >= 50) & (freqs <= 1000)
    cols.append(freqs[hum][np.argmax(power[:, hum], axis=1)])
    cols.append(np.exp(np.mean(np.log(power + _EPS), axis=1)) / (power.mean(axis=1) + _EPS))
    return np.stack(cols, axis=1)


def window_features(signal, sample_rate: int = SAMPLE_RATE) -> np.ndarray:
    """One vector for a whole window: mean and std of every frame feature."""
    frames = frame_features(signal, sample_rate)
    out = np.empty(2 * frames.shape[1])
    out[0::2] = frames.mean(axis=0)
    out[1::2] = frames.std(axis=0)
    return out


def windows_from_audio(signal, sample_rate: int = SAMPLE_RATE, seconds: int = 60) -> np.ndarray:
    """Cut a long recording into whole windows (the remainder is dropped)."""
    x = np.asarray(signal)
    size = seconds * sample_rate
    count = x.size // size
    if count == 0:
        return np.empty((0, len(FEATURE_NAMES)))
    return np.stack([window_features(x[i * size : (i + 1) * size], sample_rate) for i in range(count)])

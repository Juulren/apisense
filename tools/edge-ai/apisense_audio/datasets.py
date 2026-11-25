"""Loaders for the public hive-sound datasets, turned into the same window features the node will use.

Only to CHECK the features (phase A of docs/PLAN_EDGE_AI_ESP32.md). These are other microphones,
other climates and loose recordings, not days in a row of one hive: nothing here can say how many
false alarms per day the method will give. That is measured with our own recordings.

Datasets (not in the repository; see tools/edge-ai/README.md):
  - Kaggle annajyang/beehive-sounds: 60 s float32 segments at 22.05 kHz + a CSV with hive, date, queen state.
  - Zenodo 1321278 "To bee or not to bee": long WAVs with .lab files (bee / nobee).
  - Zenodo 321345 Open Source Beehives: Current Audio.zip, folders by hive state and place.
"""
from __future__ import annotations

import csv
import io
import re
import struct
import zipfile
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np

from .features import SAMPLE_RATE, window_features


def parse_wav(data: bytes) -> tuple[np.ndarray, int]:
    """Mono float samples in [-1, 1] and the sample rate. Handles PCM 8/16/24/32 and float32/64."""
    if data[:4] != b"RIFF" or data[8:12] != b"WAVE":
        raise ValueError("not a WAV file")
    pos, fmt, samples = 12, None, None
    while pos + 8 <= len(data):
        tag = data[pos : pos + 4]
        size = struct.unpack("<I", data[pos + 4 : pos + 8])[0]
        body = data[pos + 8 : pos + 8 + size]
        if tag == b"fmt ":
            fmt = struct.unpack("<HHIIHH", body[:16])
            if fmt[0] == 0xFFFE and len(body) >= 26:  # WAVE_FORMAT_EXTENSIBLE: real format in the sub-format
                fmt = (struct.unpack("<H", body[24:26])[0],) + fmt[1:]
        elif tag == b"data":
            samples = body
            break
        pos += 8 + size + (size & 1)
    if fmt is None or samples is None:
        raise ValueError("incomplete WAV")
    tag, channels, rate, _, _, bits = fmt
    if tag == 3:
        x = np.frombuffer(samples[: len(samples) // (bits // 8) * (bits // 8)], dtype="<f%d" % (bits // 8)).astype(np.float64)
    elif tag == 1 and bits == 16:
        x = np.frombuffer(samples[: len(samples) // 2 * 2], dtype="<i2").astype(np.float64) / 32768.0
    elif tag == 1 and bits == 8:
        x = (np.frombuffer(samples, dtype=np.uint8).astype(np.float64) - 128.0) / 128.0
    elif tag == 1 and bits == 24:
        n = len(samples) // 3
        raw = np.frombuffer(samples[: n * 3], dtype=np.uint8).reshape(n, 3).astype(np.int32)
        v = raw[:, 0] | (raw[:, 1] << 8) | (raw[:, 2] << 16)
        x = np.where(v >= 1 << 23, v - (1 << 24), v).astype(np.float64) / (1 << 23)
    elif tag == 1 and bits == 32:
        x = np.frombuffer(samples[: len(samples) // 4 * 4], dtype="<i4").astype(np.float64) / 2147483648.0
    else:
        raise ValueError(f"unsupported WAV format {tag}/{bits}")
    if channels > 1:
        x = x[: x.size // channels * channels].reshape(-1, channels).mean(axis=1)
    return x, int(rate)


def resample(x: np.ndarray, rate: int, target: int = SAMPLE_RATE) -> np.ndarray:
    """Band-limited resampling by FFT truncation or padding (fine for stationary hive sound)."""
    if rate == target or x.size == 0:
        return x
    n_out = int(round(x.size * target / rate))
    spectrum = np.fft.rfft(x)
    out = np.zeros(n_out // 2 + 1, dtype=complex)
    keep = min(spectrum.size, out.size)
    out[:keep] = spectrum[:keep]
    return np.fft.irfft(out, n_out) * (n_out / x.size)


def to_int16_scale(x: np.ndarray) -> np.ndarray:
    """The features read integer PCM as /32768; keep float input in [-1, 1) (already normalised)."""
    return np.clip(x, -1.0, 1.0)


def windows_of(x: np.ndarray, rate: int, seconds: float) -> list[np.ndarray]:
    y = to_int16_scale(resample(x, rate))
    size = int(seconds * SAMPLE_RATE)
    return [window_features(y[i * size : (i + 1) * size]) for i in range(y.size // size)]


@dataclass
class Item:
    dataset: str
    group: str  # hive (or place) the window comes from: splits are always by group
    label: str
    when: datetime | None
    source: str
    features: np.ndarray
    extra: dict


def kaggle_items(root: Path, limit: int | None = None, seconds: float = 60.0):
    """annajyang/beehive-sounds. `queen presence` 1/0 is the label; `queen status` is kept in extra."""
    csv_path = next(root.glob("all_data_updated.csv"))
    with open(csv_path, encoding="utf8") as handle:
        by_stem = {Path(r["file name"]).stem: r for r in csv.DictReader(handle)}
    wav_dir = next(root.glob("sound_files/sound_files"))
    count = 0
    for wav in sorted(wav_dir.glob("*.wav")):
        row = by_stem.get(re.sub(r"__segment\d+$", "", wav.stem))
        if row is None:
            continue
        yield from kaggle_file_items(wav, row, seconds)
        count += 1
        if limit and count >= limit:
            return


def kaggle_file_items(wav: Path, row: dict, seconds: float = 60.0) -> list[Item]:
    x, rate = parse_wav(wav.read_bytes())
    return [
        Item(
            "kaggle",
            f"hive{row['hive number']}",
            "queen" if row["queen presence"] == "1" else "noqueen",
            datetime.strptime(row["date"], "%Y-%m-%d %H:%M:%S"),
            wav.name,
            feats,
            {"queen_status": row["queen status"]},
        )
        for feats in windows_of(x, rate, seconds)
    ]


def _lab_segments(text: str):
    for line in text.splitlines():
        parts = line.split()
        if len(parts) >= 3:
            try:
                yield float(parts[0]), float(parts[1]), parts[2]
            except ValueError:
                continue


def bee_nobee_items(root: Path, limit: int | None = None, seconds: float = 10.0):
    """'To bee or not to bee': a window is bee/nobee only when one label covers it all (else skipped)."""
    count = 0
    for wav in sorted(root.glob("*.wav")):
        lab = wav.with_suffix(".lab")
        if not lab.exists():
            continue
        segs = list(_lab_segments(lab.read_text(encoding="utf8", errors="replace")))
        x, rate = parse_wav(wav.read_bytes())
        y = to_int16_scale(resample(x, rate))
        size = int(seconds * SAMPLE_RATE)
        qn = "noqueen" if "NO_QueenBee" in wav.name else "queen" if "QueenBee" in wav.name else "unknown"
        group = re.sub(r"_audio.*", "", wav.stem)
        group = re.sub(r"_\d\d_\d\d_\d{4}.*", "", group)
        for i in range(y.size // size):
            lo, hi = i * seconds, (i + 1) * seconds
            labels = {s[2] for s in segs if s[0] < hi and s[1] > lo}
            if len(labels) != 1:
                continue
            yield Item("bee_nobee", group, labels.pop(), None, wav.name, window_features(y[i * size : (i + 1) * size]), {"queen": qn})
        count += 1
        if limit and count >= limit:
            return


def obh_items(archive: Path, limit_per_folder: int | None = None, seconds: float = 30.0):
    """Open Source Beehives: the folder is the hive state, the second folder the place."""
    seen: dict[tuple[str, str], int] = {}
    with zipfile.ZipFile(archive) as z:
        for name in z.namelist():
            parts = name.split("/")
            if len(parts) < 3 or not name.lower().endswith(".wav"):
                continue
            key = (parts[0], parts[1])
            if limit_per_folder and seen.get(key, 0) >= limit_per_folder:
                continue
            try:
                x, rate = parse_wav(z.read(name))
            except Exception:
                continue
            seen[key] = seen.get(key, 0) + 1
            for feats in windows_of(x, rate, seconds):
                yield Item("obh", parts[1], parts[0], None, name, feats, {})

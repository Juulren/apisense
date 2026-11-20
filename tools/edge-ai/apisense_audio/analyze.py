"""Turn a folder of recordings into a hive baseline and an honest report.

    python -m apisense_audio.analyze data/raw --hive C-01 --train-days 5 \
        --events data/events.csv --out data/baseline_C-01.json

`events.csv` (optional) marks disturbances you caused or saw, one per line:
    start,end,notes
    2026-11-21T15:02:00-06:00,2026-11-21T15:09:00-06:00,abrí la tapa y revisé cuadros
Times without an offset are read in the hive's local time (--utc-offset).
Event windows are left out of the baseline; those in the test days measure detection.
Windows that overlap a recording gap are never trained on or scored.
"""
from __future__ import annotations

import argparse
import csv
import json
import wave
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

from .baseline import HiveBaseline
from .evaluate import evaluate
from .features import windows_from_audio


def _read_wav(path: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(path), "rb") as w:
        if w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise ValueError(f"{path.name}: se espera WAV mono de 16 bits")
        return np.frombuffer(w.readframes(w.getnframes()), dtype="<i2"), w.getframerate()


@dataclass
class Windows:
    features: np.ndarray
    hours: np.ndarray  # local hour of day
    day: np.ndarray  # local day index from the first window
    starts: list  # datetimes (UTC offset kept)
    valid: np.ndarray  # real audio (no gap, not digital silence)
    run_start: np.ndarray  # first window after a break in time


def load_windows(folder: Path, hive: str, window_seconds: int, utc_offset_hours: float) -> Windows:
    rows, starts, valid = [], [], []
    for wav in sorted(folder.glob(f"*_{hive}.wav")):
        meta = json.loads(wav.with_suffix(".json").read_text())
        samples, rate = _read_wav(wav)
        begin = datetime.fromisoformat(meta["started_at"])
        size = window_seconds * rate
        gaps = [(g["at_sample"], g["at_sample"] + g.get("samples", g.get("blocks", 0) * 256)) for g in meta.get("gaps", [])]
        for i, vec in enumerate(windows_from_audio(samples, rate, window_seconds)):
            a, b = i * size, (i + 1) * size
            chunk = samples[a:b]
            rows.append(vec)
            starts.append(begin + timedelta(seconds=a / rate))
            valid.append(bool(np.any(chunk)) and not any(s < b and e > a for s, e in gaps))
    if not rows:
        raise SystemExit(f"No hay grabaciones de {hive} en {folder}")
    order = np.argsort([s.timestamp() for s in starts])
    rows = np.array(rows)[order]
    starts = [starts[i] for i in order]
    valid_arr = np.array(valid)[order]
    local = [s.astimezone(timezone(timedelta(hours=utc_offset_hours))) for s in starts]
    hours = np.array([t.hour + t.minute / 60 for t in local])
    first = local[0].date()
    day = np.array([(t.date() - first).days for t in local])
    run_start = np.ones(len(starts), dtype=bool)
    for i in range(1, len(starts)):
        run_start[i] = abs((starts[i] - starts[i - 1]).total_seconds() - window_seconds) > 1.0
    return Windows(rows, hours, day, starts, valid_arr, run_start)


def load_events(path: Path | None, starts, window_seconds: int, utc_offset_hours: float = -6):
    """Event windows as (first, last) indexes, plus how many events matched no recording."""
    if not path:
        return [], 0
    zone = timezone(timedelta(hours=utc_offset_hours))

    def when(text: str) -> datetime:
        t = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
        return t if t.tzinfo else t.replace(tzinfo=zone)

    out, missed = [], 0
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            a, b = when(row["start"]), when(row["end"])
            hit = [i for i, s in enumerate(starts) if s < b and s + timedelta(seconds=window_seconds) > a]
            if hit:
                out.append((hit[0], hit[-1]))
            else:
                missed += 1
    return out, missed


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("folder", type=Path)
    p.add_argument("--hive", required=True)
    p.add_argument("--train-days", type=int, required=True)
    p.add_argument("--window-seconds", type=int, default=60)
    p.add_argument("--utc-offset", type=float, default=-6, help="hours from UTC for the hive's local time (Mérida: -6)")
    p.add_argument("--events", type=Path)
    p.add_argument("--out", type=Path)
    a = p.parse_args(argv)
    w = load_windows(a.folder, a.hive, a.window_seconds, a.utc_offset)
    events, missed = load_events(a.events, w.starts, a.window_seconds, a.utc_offset)
    report = evaluate(w.features, w.hours, w.day, a.train_days, events, valid=w.valid, run_start=w.run_start)
    print("\n".join(report.lines()))
    print(f"Ventanas con audio válido: {int(w.valid.sum())}/{len(w.valid)}")
    if missed:
        print(f"{missed} evento(s) del CSV no coinciden con ninguna grabación y se omitieron.")
    if a.out:
        train = np.isin(w.day, sorted(set(w.day.tolist()))[: a.train_days]) & w.valid
        for s, e in events:
            train[s : e + 1] = False
        a.out.write_text(HiveBaseline.fit(w.features[train], w.hours[train]).dumps())
        print(f"Línea base guardada en {a.out}")


if __name__ == "__main__":
    main()

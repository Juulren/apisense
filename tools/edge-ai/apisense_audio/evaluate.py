"""Honest evaluation: train on the first days, test on later days.

Mixing windows of the same hive and day between training and testing makes any
model look excellent (the literature reports 99 % that falls to 34-84 % on new
hives), so this module only ever splits by day.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .baseline import Detector, HiveBaseline


@dataclass
class Report:
    train_days: int
    test_days: int
    false_alarms_per_day: float
    windows_flagged_pct: float
    events: int
    events_detected: int
    detection_rate: float | None
    events_ignored: int = 0  # labelled events that fell in the training days

    def lines(self) -> list[str]:
        rate = "n/a (sin eventos etiquetados)" if self.detection_rate is None else f"{self.detection_rate:.0%}"
        lines = [
            f"Días de entrenamiento: {self.train_days} · días de prueba: {self.test_days}",
            f"Falsas alarmas por día (tiempo normal de prueba): {self.false_alarms_per_day:.2f}",
            f"Ventanas marcadas como diferentes: {self.windows_flagged_pct:.1f} %",
            f"Eventos etiquetados detectados: {self.events_detected}/{self.events} ({rate})",
        ]
        if self.events_ignored:
            lines.append(
                f"{self.events_ignored} evento(s) cayeron en los días de entrenamiento: se excluyeron "
                "de la línea base y no cuentan para la detección."
            )
        if 0 < self.events < 10:
            lines.append("Con menos de 10 eventos la tasa de detección es solo orientativa.")
        return lines


def evaluate(
    windows: np.ndarray,
    hours: np.ndarray,
    day: np.ndarray,
    train_days: int,
    events: list[tuple[int, int]] | None = None,
    grace: int = 3,
    valid: np.ndarray | None = None,
    run_start: np.ndarray | None = None,
) -> Report:
    """`day` is an integer day index per window. `events` are (start, end) window indexes
    (inclusive) of labelled disturbances. Event windows in the training days are left out
    of the baseline and ignored for detection; the rest are detected if the node raises an
    alarm from `start` to `end + grace`. `valid` marks windows with real audio: gaps are
    never trained on, never scored, and they reset the detector's short memory;
    `run_start` marks the first window after a break in time, which resets it too."""
    windows = np.asarray(windows, dtype=float)
    hours = np.asarray(hours, dtype=float)
    day = np.asarray(day)
    valid = np.ones(len(windows), dtype=bool) if valid is None else np.asarray(valid, dtype=bool)
    days = sorted(set(day.tolist()))
    if len(days) <= train_days:
        raise ValueError("there must be days left to test on")
    in_train_day = np.isin(day, days[:train_days])
    events = events or []
    kept = [(s, e) for s, e in events if not in_train_day[s : e + 1].any()]
    in_event = np.zeros(len(windows), dtype=bool)
    for s, e in events:
        in_event[s : e + 1] = True
    train = in_train_day & ~in_event & valid
    model = HiveBaseline.fit(windows[train], hours[train])
    detector = Detector(model)
    verdicts = np.zeros(len(windows), dtype=int)
    breaks = np.zeros(len(windows), dtype=bool) if run_start is None else np.asarray(run_start, dtype=bool)
    for i in np.flatnonzero(~in_train_day):
        if breaks[i]:
            detector.reset()
        if not valid[i]:
            detector.reset()
            continue
        verdicts[i], _ = detector.update(windows[i], hours[i])
    test = ~in_train_day & valid
    # Alarms come from a rising edge of "different" (the node reports one alarm per episode).
    rising = (verdicts == 1) & (np.roll(verdicts, 1) == 0)
    tail = np.zeros(len(windows), dtype=bool)
    for s, e in kept:
        tail[e + 1 : e + 1 + grace] = True  # the 3-of-4 rule lags: not a false alarm, and not "normal" either
    normal = test & ~in_event & ~tail
    per_day = float(np.median([int((day == d).sum()) for d in days])) or 1.0
    false_alarms = int(rising[normal].sum())
    detected = sum(1 for s, e in kept if rising[s : min(len(verdicts), e + 1 + grace)].any())
    return Report(
        train_days=train_days,
        test_days=len(days) - train_days,
        false_alarms_per_day=false_alarms / max(normal.sum() / per_day, 1e-9) if normal.any() else 0.0,
        windows_flagged_pct=100.0 * float(verdicts[test].mean()) if test.any() else 0.0,
        events=len(kept),
        events_detected=detected,
        detection_rate=(detected / len(kept)) if kept else None,
        events_ignored=len(events) - len(kept),
    )

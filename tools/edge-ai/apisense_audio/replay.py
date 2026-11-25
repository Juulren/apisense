"""Feed real hive recordings (the Kaggle beehive-sounds features) to the node's brain ON THE BOARD.

    python -m apisense_audio.replay --port COM3 [--features data/features/kaggle.npz] [--report out.md]

Flash firmware/learn_test first. For each hive the board learns from the first 75 % of its first period
(queen status 0) and then judges everything that came after, in date order, without having seen it: the rest
of that normal period (the false-alarm check), the days without a queen, and the later periods with a queen
again (the control: if those alarm as much as the queenless days, the detector is only seeing time go by).
The same rules as on the node run on the board (score, 3-of-4 persistence, slow drift with its cap). Nothing
is written to the board's flash, and nothing learned here may be reused for another hive.
"""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from pathlib import Path

import numpy as np

from .learn_parity import fit_on_board, observe_on_board, reopen

TRAIN_SHARE = 0.75
MIN_TRAIN = 100
CHUNK = 600  # the test sketch judges at most this many windows per command
PARTS = [("normal", "periodo inicial no visto"), ("1", "sin reina"), ("2", "estado 2"), ("3", "estado 3")]


def auc(low: np.ndarray, high: np.ndarray) -> float:
    """Probability that a window of `high` scores above one of `low` (0.5 = no difference)."""
    both = np.concatenate([low, high])
    order = both.argsort(kind="mergesort")
    ranks = np.empty(len(both))
    ranks[order] = np.arange(1, len(both) + 1)
    for value in np.unique(both):
        same = both == value
        ranks[same] = ranks[same].mean()
    return float((ranks[len(low):].sum() - len(high) * (len(high) + 1) / 2) / (len(low) * len(high)))


def episodes(alarm: np.ndarray) -> int:
    """Times the verdict went from 0 to 1."""
    return int(np.sum((alarm[1:] == 1) & (alarm[:-1] == 0)) + (len(alarm) > 0 and alarm[0] == 1))


def order_of(when: np.ndarray, source: np.ndarray) -> np.ndarray:
    return np.array(sorted(range(len(when)), key=lambda i: (str(when[i]), str(source[i]))), dtype=int)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True)
    ap.add_argument("--features", default="data/features/kaggle.npz")
    ap.add_argument("--report", help="also write the table to this Markdown file")
    a = ap.parse_args()
    d = np.load(a.features)
    lines = ["| Colmena | Periodo | Ventanas | Días | Sobre el umbral | En alarma | Episodios de alarma | Puntaje mediano |",
             "|---|---|---|---|---|---|---|---|"]
    notes = []
    ser = reopen(a.port)
    try:
        for hive in sorted(set(d["group"].tolist())):
            m = d["group"] == hive
            order = order_of(d["when"][m], d["source"][m])
            x = d["x"][m][order]
            when = [datetime.fromisoformat(str(t)) for t in d["when"][m][order]]
            status = np.array([str(e).split("=")[-1] for e in d["extra"][m][order]])
            hours = np.array([t.hour + t.minute / 60 for t in when])
            first = np.flatnonzero(status == "0")
            cut = int(len(first) * TRAIN_SHARE)
            if cut < MIN_TRAIN:
                notes.append(f"- {hive}: no se evaluó; solo {len(first)} ventanas del periodo inicial.")
                continue
            train = first[:cut]
            test = np.arange(train[-1] + 1, len(x))
            board = fit_on_board(ser, x[train], hours[train])
            threshold = board["threshold"]
            scores, alarm, taken = [], [], 0
            for at in range(0, len(test), CHUNK):
                part = test[at:at + CHUNK]
                got, _, flags, s = observe_on_board(ser, x[part], hours[part])
                taken += got
                scores.append(np.array(s, dtype=float))
                alarm.append(np.array(flags, dtype=int))
            scores, alarm = np.concatenate(scores), np.concatenate(alarm)
            names = np.where(status[test] == "0", "normal", status[test])
            days_train = len({when[i].date() for i in train})
            notes.append(f"- {hive}: aprendió con {len(train)} ventanas de {days_train} días "
                         f"(la placa guardó {board['total']}), umbral {threshold:.2f}; después incorporó {taken} de {len(test)}.")
            for key, label in PARTS:
                pick = names == key
                if not pick.any():
                    continue
                days = len({when[i].date() for i in test[pick]})
                lines.append(f"| {hive} | {label} | {pick.sum()} | {days} | {np.mean(scores[pick] > threshold):.1%} | "
                             f"{np.mean(alarm[pick]):.1%} | {episodes(alarm[pick])} | {np.median(scores[pick]):.2f} |")
            normal = scores[names == "normal"]
            parts = [f"{label} {auc(normal, scores[names == key]):.2f}"
                     for key, label in PARTS[1:] if (names == key).any() and len(normal)]
            notes.append(f"  - Separación frente al periodo normal no visto (AUC, 0,5 = ninguna): {', '.join(parts)}.")
            print(f"{hive}: listo ({len(test)} ventanas juzgadas en la placa)")
    finally:
        ser.close()
    text = "\n".join(lines) + "\n\n" + "\n".join(notes) + "\n"
    print(text)
    if a.report:
        Path(a.report).write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())

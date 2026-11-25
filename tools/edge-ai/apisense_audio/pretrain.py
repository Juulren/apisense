"""Train a starting "usual sound" from the public datasets and put it into the node's flash.

    python -m apisense_audio.pretrain --check [--audio-dir C:/apisense-grabaciones]     # PC only
    python -m apisense_audio.pretrain --port COM3                                      # flash firmware/learn_test first

It takes only windows labelled as ordinary hive sound (Kaggle with a queen, To bee or not to bee "bee",
Open Source Beehives "Active"), the the same number in each 3-hour slot, mixed at random, lets the board fit
the baseline and its threshold, saves it to flash and checks it survives a restart. Then flash
firmware/apisense_node with the quick build (-DAPISENSE_QUICK), which keeps it.

What this is NOT: a detector of any disease or of the queen. It only says how far a sound is from the mixture
of these recordings, made with other microphones in other hives. `--check` shows how it rates your own
recordings and a few sounds that are obviously not a hive; read that before trusting a verdict.
To go back to learning the hive's own sound, send RESET to the node.
"""
from __future__ import annotations

import argparse
import struct
import sys
import wave
from pathlib import Path

import numpy as np

from .baseline import HOUR_BUCKETS, HiveBaseline
from .features import SAMPLE_RATE, window_features
from .learn_parity import PER_BUCKET, compare_baselines, Check, fit_on_board, read_after, reopen, reset_board, _wait_head

SOURCES = [("kaggle", "queen", 256), ("beenobee", "bee", 192), ("obh", "Active", 64)]
TOTAL = HOUR_BUCKETS * PER_BUCKET  # 512


def training_set(features_dir: Path, seed: int = 11):
    """(windows, hours, description). Spread evenly over each dataset's hives or recordings."""
    rng = np.random.default_rng(seed)
    chosen, summary = [], []
    for name, label, wanted in SOURCES:
        d = np.load(features_dir / f"{name}.npz")
        # "bee" only says a bee is heard: recordings of a hive without its queen are not ordinary hive sound.
        missing_queen = np.char.find(np.char.lower(d["group"].astype(str)), "missing queen") >= 0
        pick = np.flatnonzero((d["label"] == label) & ~missing_queen)
        queues = [list(rng.permutation(pick[d["group"][pick] == g])) for g in sorted(set(d["group"][pick].tolist()))]
        taken = []
        while len(taken) < wanted and any(queues):
            for q in queues:
                if q and len(taken) < wanted:
                    taken.append(q.pop())
        chosen += [d["x"][i] for i in taken]
        summary.append(f"{name}: {len(taken)} ventanas «{label}» de {len(queues)} colmenas o grabaciones")
    if len(chosen) != TOTAL:
        raise SystemExit(f"se necesitan {TOTAL} ventanas y hay {len(chosen)}")
    # Shuffle before handing out slots; otherwise the take-in-turns order ties each slot to one hive.
    windows = np.array(chosen)[rng.permutation(TOTAL)]
    # The public sets have no common clock: shuffled window i goes to slot i % 8, so each slot gets a random mixture.
    hours = np.array([(i % HOUR_BUCKETS) * 3 + 1.5 for i in range(TOTAL)])
    return windows, hours, summary


def _probe(kind: str) -> np.ndarray:
    rng = np.random.default_rng(5)
    n = 60 * SAMPLE_RATE
    t = np.arange(n) / SAMPLE_RATE
    if kind == "casi silencio":
        x = rng.normal(0, 10 ** (-75 / 20), n)
    elif kind == "ruido blanco":
        x = rng.normal(0, 10 ** (-25 / 20), n)
    elif kind == "tono de 1 kHz":
        x = np.sin(2 * np.pi * 1000 * t) * 10 ** (-25 / 20) * np.sqrt(2)
    else:  # tone of 3 kHz, loud
        x = np.sin(2 * np.pi * 3000 * t) * 10 ** (-12 / 20) * np.sqrt(2)
    return np.clip(np.round(x * 32768), -32768, 32767).astype(np.int16)


def check_in_pc(model: HiveBaseline, audio_dir: str | None) -> None:
    def rate(name: str, windows: list[np.ndarray]) -> None:
        scores = [model.score(w, 13.5) for w in windows]
        over = sum(s > model.threshold for s in scores)
        print(f"  {name}: puntaje {min(scores):.2f}..{max(scores):.2f} · sobre el umbral {over} de {len(scores)}")

    print(f"umbral del modelo: {model.threshold:.2f}")
    if audio_dir:
        mine = []
        for f in sorted(Path(audio_dir).rglob("*.wav")):
            w = wave.open(str(f))
            x = np.frombuffer(w.readframes(w.getnframes()), "<i2")
            size = 60 * w.getframerate()
            mine += [window_features(x[i : i + size]) for i in range(0, len(x) - size + 1, size)]
        if mine:
            rate("tu grabación", mine)
    for kind in ["casi silencio", "ruido blanco", "tono de 1 kHz", "tono de 3 kHz fuerte"]:
        rate(f"control · {kind}", [window_features(_probe(kind))])


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--features-dir", default="data/features")
    ap.add_argument("--check", action="store_true", help="PC only: rate your recordings and the control sounds")
    ap.add_argument("--audio-dir")
    ap.add_argument("--port")
    a = ap.parse_args()
    windows, hours, summary = training_set(Path(a.features_dir))
    for line in summary:
        print(line)
    model = HiveBaseline.fit(windows, hours)
    if a.check or not a.port:
        check_in_pc(model, a.audio_dir)
        return 0

    check = Check()
    ser = reopen(a.port)
    try:
        reset_board(ser)
        board = fit_on_board(ser, windows, hours, ready=True)
        compare_baselines(check, "en la placa", board, model)
        check("ventanas guardadas", board["total"] == TOTAL, str(board["total"]))
        ser.write(b"\xa5\x64")
        _wait_head(ser, 0x65)
        (micros,) = struct.unpack("<I", ser.read(4))
        ser.close()
        ser = reopen(a.port)  # the board restarts: what comes back was read from flash
        back = read_after(ser)
        check("tras reiniciar: lista", back["phase"] == 2, f"fase {back['phase']}")
        check("tras reiniciar: mismo umbral", abs(back["threshold"] - board["threshold"]) < 1e-5,
              f"{back['threshold']:.4f}")
        check("tras reiniciar: ventanas", back["total"] == TOTAL, str(back["total"]))
        print(f"guardado en flash en {micros / 1000:.0f} ms")
    finally:
        ser.close()
    print("ENTRENADO Y GUARDADO EN LA PLACA" if not check.failed else f"{check.failed} COMPROBACIONES FALLARON")
    return 1 if check.failed else 0


if __name__ == "__main__":
    sys.exit(main())

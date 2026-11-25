"""Check the ON-NODE learning (firmware/learn_test) against the Python baseline and its behaviour.

    python -m apisense_audio.learn_parity --port COM3 [--features data/features/kaggle.npz]

Flash tools/edge-ai/firmware/learn_test first. Needs pyserial. Tests, in order:
  1 fit       centre, scale and threshold equal HiveBaseline.fit (hours spread evenly)
  2 overflow  more windows than a slot keeps -> equal to Python on the last 64 of each slot
  3 sparse    a slot with few windows borrows the all-day row; an empty slot too
  4 drift     usual windows are taken in, different ones never are, and the baseline stays put
  5 timeline  no clock -> nothing; learning for 7 days; then ready; later anomalies raise the alarm
  6 power     after a reset of the board the learned state is back (flash)
  7 reset     the reset command forgets everything, also after another reset
  8 reboot    a reboot in the middle of a learning day does not count that day twice
  9 between   windows next to an intermittent anomaly are not learned
 10 slow      a slow drift cannot drag the baseline further than the cap
"""
from __future__ import annotations

import argparse
import struct
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from .baseline import FLOORS, HOUR_BUCKETS, HiveBaseline, bucket_of

PER_BUCKET = 64
FEATURES = len(FLOORS)
STATE_BYTES = 2 + 1 + 1 + 2 + 4 + 4 + 4 + 4 + 4 * HOUR_BUCKETS * FEATURES * 2  # head, status, phase, pad, 3 counters, threshold, arrays


def _records(windows: np.ndarray, hours: np.ndarray) -> bytes:
    return b"".join(struct.pack("<f", float(h)) + np.asarray(w, "<f4").tobytes() for w, h in zip(windows, hours))


def _send_records(ser, windows, hours) -> None:
    for w, h in zip(windows, hours):
        ser.write(struct.pack("<f", float(h)) + np.asarray(w, "<f4").tobytes())
        if ser.read(1) != b"k":
            raise RuntimeError("la placa no respondió (¿está cargado learn_test?)")


def _wait_head(ser, tag: int, seconds: float = 15.0) -> None:
    want = bytes([0xA5, tag])
    head = ser.read(2)
    deadline = time.time() + seconds
    while head != want:
        if time.time() > deadline:
            raise RuntimeError(f"sin respuesta {want.hex()} de la placa")
        head = head[1:] + ser.read(1)


def read_state(ser) -> dict:
    _wait_head(ser, 0x61)
    raw = ser.read(STATE_BYTES - 2)
    status, phase = raw[0], raw[1]
    days, total, covered = struct.unpack("<III", raw[4:16])
    (threshold,) = struct.unpack("<f", raw[16:20])
    arrays = np.frombuffer(raw[20:], "<f4").astype(float).reshape(2, HOUR_BUCKETS, FEATURES)
    return dict(status=status, phase=phase, days=days, total=total, covered=covered,
                threshold=threshold, center=arrays[0], scale=arrays[1])


def fit_on_board(ser, windows, hours, ready: bool = False) -> dict:
    ser.reset_input_buffer()
    ser.write(b"\xa5\x60" + struct.pack("<II", len(windows), 1 if ready else 0))
    _send_records(ser, windows, hours)
    return read_state(ser)


def observe_on_board(ser, windows, hours):
    ser.write(b"\xa5\x62" + struct.pack("<I", len(windows)))
    _send_records(ser, windows, hours)
    _wait_head(ser, 0x63)
    n, taken = struct.unpack("<II", ser.read(8))
    flags = np.frombuffer(ser.read(2 * n), np.uint8).reshape(n, 2)
    scores = np.frombuffer(ser.read(4 * n), "<f4")
    return taken, flags[:, 0], flags[:, 1], scores


def timeline_on_board(ser, unix: int, windows, step_ms: int = 15 * 60 * 1000):
    ser.write(b"\xa5\x68" + struct.pack("<II", unix, len(windows)))
    for i, w in enumerate(windows):
        ser.write(struct.pack("<I", i * step_ms) + np.asarray(w, "<f4").tobytes())
        if ser.read(1) != b"k":
            raise RuntimeError("la placa no respondió en la línea de tiempo")
    _wait_head(ser, 0x69)
    (n,) = struct.unpack("<I", ser.read(4))
    out = np.frombuffer(ser.read(4 * n), np.uint8).reshape(n, 4)
    scores = np.frombuffer(ser.read(4 * n), "<f4")
    return out, scores


def reset_board(ser) -> None:
    ser.write(b"\xa5\x6a")
    if ser.read(1) != b"k":
        raise RuntimeError("la placa no confirmó el reinicio del aprendizaje")


def reopen(port: str):
    import serial

    ser = serial.Serial(port, 921600, timeout=8)
    time.sleep(2.5)  # the board resets when the port opens
    ser.reset_input_buffer()
    return ser


class Check:
    def __init__(self) -> None:
        self.failed = 0

    def __call__(self, name: str, ok: bool, detail: str = "") -> None:
        self.failed += not ok
        print(f"  {'OK    ' if ok else 'FALLO '}{name}{(' · ' + detail) if detail else ''}")


def compare_baselines(check: Check, name: str, board: dict, ref: HiveBaseline) -> None:
    center_err = float(np.max(np.abs(board["center"] - ref.center) / FLOORS))
    scale_err = float(np.max(np.abs(board["scale"] - ref.scale) / FLOORS))
    thr_err = abs(board["threshold"] - ref.threshold) / ref.threshold
    check(f"{name}: centro", center_err <= 0.05, f"peor {center_err:.4f} de piso")
    check(f"{name}: escala", scale_err <= 0.05, f"peor {scale_err:.4f} de piso")
    check(f"{name}: umbral", thr_err <= 0.01, f"placa {board['threshold']:.4f} python {ref.threshold:.4f}")


def last_per_bucket(windows: np.ndarray, hours: np.ndarray, cap: int):
    keep = []
    for b in range(HOUR_BUCKETS):
        idx = [i for i, h in enumerate(hours) if bucket_of(h) == b]
        keep += idx[-cap:]
    keep.sort()
    return windows[keep], hours[keep]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True)
    ap.add_argument("--features", default="data/features/kaggle.npz")
    a = ap.parse_args()

    data = np.load(a.features)  # our own plain arrays: no pickle needed
    x, group = data["x"], data["group"]
    biggest = max(set(group.tolist()), key=lambda g: int((group == g).sum()))
    pool = x[group == biggest]
    print(f"datos: {len(pool)} ventanas de {biggest} ({Path(a.features).name})")
    rng = np.random.default_rng(7)
    check = Check()
    ser = reopen(a.port)
    try:
        # 1. fit
        reset_board(ser)
        n = 8 * 48
        w1 = pool[:n]
        h1 = np.array([(i % 8) * 3 + 1.5 for i in range(n)])
        t0 = time.time()
        board = fit_on_board(ser, w1, h1)
        print(f"1 fit ({n} ventanas, {time.time() - t0:.1f} s en total con el envío)")
        compare_baselines(check, "fit", board, HiveBaseline.fit(w1, h1))
        check("fit: ventanas guardadas", board["total"] == n, str(board["total"]))

        # 2. overflow: 75 windows per slot, the slot keeps the last 64
        n2 = 8 * 75
        w2 = pool[np.arange(n2) % len(pool)] + rng.normal(0, 0.01, size=(n2, FEATURES)) * FLOORS
        h2 = np.array([(i % 8) * 3 + 1.5 for i in range(n2)])
        board = fit_on_board(ser, w2, h2)
        kw, kh = last_per_bucket(w2, h2, PER_BUCKET)
        print("2 desborde (75 ventanas por franja, se guardan las últimas 64)")
        compare_baselines(check, "desborde", board, HiveBaseline.fit(kw, kh))
        check("desborde: ventanas guardadas", board["total"] == 8 * PER_BUCKET, str(board["total"]))

        # 3. sparse: slots 0-5 full, slot 6 with 10 windows, slot 7 empty
        parts_w, parts_h = [], []
        for b in range(6):
            parts_w.append(pool[b * 50:(b + 1) * 50])
            parts_h.append(np.full(50, b * 3 + 1.5))
        parts_w.append(pool[300:310])
        parts_h.append(np.full(10, 6 * 3 + 1.5))
        w3, h3 = np.concatenate(parts_w), np.concatenate(parts_h)
        board = fit_on_board(ser, w3, h3)
        print("3 franjas con pocos datos o vacías")
        compare_baselines(check, "franjas", board, HiveBaseline.fit(w3, h3))
        check("franjas: cubiertas", board["covered"] == 6, str(board["covered"]))

        # 4. drift: refit on the first set, then usual and different windows
        board = fit_on_board(ser, w1, h1)
        before_c, before_s, thr = board["center"].copy(), board["scale"].copy(), board["threshold"]
        usual_w = pool[n:n + 100]
        usual_h = np.array([(i % 8) * 3 + 1.5 for i in range(100)])
        taken, got, alarm, _ = observe_on_board(ser, usual_w, usual_h)
        print("4 deriva")
        check("deriva: habituales entran", taken >= 80, f"{taken} de 100")
        check("deriva: habituales sin alarma sostenida", int(alarm.sum()) <= 10, f"{int(alarm.sum())} alarmas")
        board = read_after(ser)
        steady_c, steady_s = board["center"].copy(), board["scale"].copy()
        different = np.array([steady_c[bucket_of(h)] + 12.0 * steady_s[bucket_of(h)] for h in usual_h[:60]])
        taken, got, alarm, scores = observe_on_board(ser, different, usual_h[:60])
        check("deriva: distintas no entran", taken == 0, f"{taken} de 60")
        check("deriva: alarma tras 3 ventanas", alarm[:2].sum() == 0 and alarm[2:].all(), f"{alarm[:6].tolist()}")
        board = read_after(ser)
        check("deriva: la línea base no se movió", np.allclose(board["center"], steady_c) and
              np.allclose(board["scale"], steady_s))
        check("deriva: el umbral nunca se mueve", abs(board["threshold"] - thr) < 1e-6)

        # 5. timeline
        reset_board(ser)
        day = 96
        total = 9 * day
        tw = pool[np.arange(total) % len(pool)] + rng.normal(0, 0.01, size=(total, FEATURES)) * FLOORS
        out, _ = timeline_on_board(ser, 0, tw[:5])
        print("5 línea de tiempo")
        check("tiempo: sin reloj no hace nada", (out[:, 0] == 0).all() and not out[:, 2].any())
        start = int(datetime(2026, 11, 26, 6, 0, tzinfo=timezone.utc).timestamp())  # 00:00 in Yucatán
        out, scores = timeline_on_board(ser, start, tw)
        status = out[:, 0]
        ready_at = int(np.argmax(status == 2))
        expected = 6 * day + 12  # the 12th window of day 7 completes the 7th day; the next is the first judged
        check("tiempo: aprende 7 días", (status[:expected] == 1).all() and ready_at == expected,
              f"listo en la ventana {ready_at}, esperado {expected}")
        check("tiempo: luego juzga", (status[expected:] == 2).all())
        check("tiempo: pocas alarmas con ventanas habituales", int(out[expected:, 1].sum()) <= 0.1 * (total - expected),
              f"{int(out[expected:, 1].sum())} de {total - expected}")
        state = read_after(ser)
        check("tiempo: 7 días contados", state["days"] == 7, str(state["days"]))
        changed = int(out[:, 3].sum())
        check("tiempo: pide guardar solo cuando cambia el estado", 7 <= changed <= 20, f"{changed} avisos")
        anomalous = np.array([state["center"][3] + 12.0 * state["scale"][3] for _ in range(6)])
        later = start + 9 * 86400 + 9 * 3600  # 09:00 local on day 10: slot 3, where the anomaly was built
        out2, _ = timeline_on_board(ser, later, anomalous)
        check("tiempo: veredicto 1 ante sonido distinto", out2[:, 1].tolist() == [0, 0, 1, 1, 1, 1],
              f"{out2[:, 1].tolist()}")
        reference = read_after(ser)

        # 6. power cut
        ser.write(b"\xa5\x64")
        _wait_head(ser, 0x65)
        (micros,) = struct.unpack("<I", ser.read(4))
        ser.close()
        ser = reopen(a.port)
        ser.write(b"\xa5\x66")
        back = read_state(ser)
        print(f"6 corte de energía (guardar tardó {micros / 1000:.0f} ms)")
        check("corte: fase lista", back["phase"] == 2, f"fase {back['phase']}")
        check("corte: días y ventanas", back["days"] == 7 and back["total"] == reference["total"],
              f"{back['days']} días, {back['total']} ventanas")
        check("corte: umbral", abs(back["threshold"] - reference["threshold"]) < 1e-6)
        drift = np.abs(back["center"] - reference["center"]) / reference["scale"]
        check("corte: línea base reconstruida", float(drift.max()) <= 0.5, f"peor {float(drift.max()):.3f} escalas")

        # 7. reset
        reset_board(ser)
        ser.write(b"\xa5\x66")
        wiped = read_state(ser)
        ser.close()
        ser = reopen(a.port)
        ser.write(b"\xa5\x66")
        wiped2 = read_state(ser)
        print("7 reinicio del aprendizaje")
        check("reinicio: vuelve a aprender", wiped["phase"] == 1 and wiped["total"] == 0 and wiped["days"] == 0)
        check("reinicio: sigue vacío tras un corte", wiped2["phase"] == 1 and wiped2["total"] == 0)

        # 8. reboot in the middle of a learning day
        reset_board(ser)
        part = pool[:20]
        timeline_on_board(ser, start, part)
        ser.close()
        ser = reopen(a.port)
        timeline_on_board(ser, start + 6 * 3600, pool[20:40])  # same day, after the reboot
        one = read_after(ser)
        timeline_on_board(ser, start + 86400, pool[40:60])
        two = read_after(ser)
        print("8 reinicio de la placa a mitad del día")
        check("reboot: el mismo día no cuenta dos veces", one["days"] == 1, f"{one['days']} días")
        check("reboot: el día siguiente sí", two["days"] == 2, f"{two['days']} días")

        # 9. intermittent anomaly: the usual windows in between are not learned
        board = fit_on_board(ser, w1, h1)
        usual = pool[n:n + 24]
        hours = np.array([(i % 8) * 3 + 1.5 for i in range(24)])
        mixed, mixed_h, is_bad = [], [], []
        for i in range(24):
            bad = i >= 8 and i % 2 == 0
            if bad:
                b = bucket_of(hours[i])
                mixed.append(board["center"][b] + 12.0 * board["scale"][b])
            else:
                mixed.append(usual[i])
            mixed_h.append(hours[i])
            is_bad.append(bad)
        taken, got, alarm, _ = observe_on_board(ser, np.array(mixed), np.array(mixed_h))
        after = [i for i in range(24) if i >= 9 and not is_bad[i]]
        print("9 anomalía intermitente")
        check("intermitente: sin alarma (2 de 4)", int(alarm.sum()) == 0, f"{int(alarm.sum())} alarmas")
        check("intermitente: lo habitual entre medias no se aprende", int(got[after].sum()) == 0,
              f"{int(got[after].sum())} de {len(after)}")
        check("intermitente: antes de la anomalía sí se aprendía", int(got[:8].sum()) >= 6, f"{int(got[:8].sum())} de 8")

        # 10. slow drift: the centre cannot leave the cap
        board = fit_on_board(ser, w1, h1)
        c0, s0 = board["center"][0].copy(), board["scale"][0].copy()
        ramp = np.array([c0 + (k / 600) * 8.0 * s0 for k in range(1, 601)])
        taken, got, alarm, _ = observe_on_board(ser, ramp[:300], np.full(300, 1.5))
        t2, got2, alarm2, _ = observe_on_board(ser, ramp[300:], np.full(300, 1.5))
        end = read_after(ser)
        moved = float(np.max(np.abs(end["center"][0] - c0) / s0))
        print("10 deriva lenta")
        check("deriva lenta: el centro no pasa del tope", moved <= 3.01, f"{moved:.2f} escalas")
        check("deriva lenta: la escala no baja de 0,8", bool(np.all(end["scale"][0] >= 0.8 * s0 - 1e-6)))
        check("deriva lenta: al final se rechaza y se alarma", t2 < 300 and int(alarm2[-5:].sum()) == 5,
              f"{t2} de 300 aprendidas, alarmas finales {alarm2[-5:].tolist()}")
    finally:
        ser.close()
    print("TODO IGUAL" if not check.failed else f"{check.failed} COMPROBACIONES FALLARON")
    return 1 if check.failed else 0


def read_after(ser) -> dict:
    ser.write(b"\xa5\x66")
    return read_state(ser)


if __name__ == "__main__":
    sys.exit(main())

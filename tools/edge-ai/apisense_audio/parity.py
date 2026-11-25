"""Compare the window features computed ON THE ESP32 (firmware/parity_test) with the Python ones.

    python -m apisense_audio.parity --port COM3 --seconds 8 --audio data/raw/x.wav --audio kaggle:file.wav

Flash tools/edge-ai/firmware/parity_test first. Needs pyserial. Reports, per feature, the largest
difference in its own unit and in units of the feature's smallest meaningful spread
(baseline.FLOORS); parity holds when every feature is inside the tolerance below.
"""
from __future__ import annotations

import argparse
import struct
import sys
import time
from pathlib import Path

import numpy as np

from .baseline import FLOORS
from .datasets import parse_wav, resample
from .features import FEATURE_NAMES, SAMPLE_RATE, window_features

# Tolerance in units of the feature's floor (0.5 dB for the std of a dB feature, 1 dB for its mean...).
# float32 against float64 should be far inside this; a real porting error is not.
TOLERANCE_FLOORS = 0.05


def board_features(ser, pcm: np.ndarray):
    ser.reset_input_buffer()
    ser.write(b"\xa5\x5c" + struct.pack("<I", pcm.size))
    data = pcm.astype("<i2").tobytes()
    for i in range(0, len(data), 1024):
        ser.write(data[i : i + 1024])
        if ser.read(1) != b"k":
            raise RuntimeError("la placa no respondió al bloque (¿está cargado parity_test?)")
    head = ser.read(2)
    deadline = time.time() + 10
    while head != b"\xa5\x5d":
        if time.time() > deadline:
            raise RuntimeError("sin respuesta de la placa")
        head = head[1:] + ser.read(1)
    frames, micros = struct.unpack("<II", ser.read(8))
    values = np.frombuffer(ser.read(4 * len(FEATURE_NAMES)), dtype="<f4").astype(float)
    return values, frames, micros


def load_pcm(spec: str, seconds: float) -> np.ndarray:
    x, rate = parse_wav(Path(spec).read_bytes())
    y = resample(x, rate, SAMPLE_RATE)
    size = int(seconds * SAMPLE_RATE)
    y = y[: size] if y.size >= size else np.pad(y, (0, size - y.size))
    return np.clip(np.round(y * 32768.0), -32768, 32767).astype(np.int16)


def main() -> int:
    import serial  # pip install pyserial

    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True)
    ap.add_argument("--audio", action="append", required=True, help="WAV file (repeat the option for several)")
    ap.add_argument("--seconds", type=float, default=8.0)
    a = ap.parse_args()
    ok = True
    with serial.Serial(a.port, 921600, timeout=5) as ser:
        time.sleep(2.0)  # the board resets when the port opens
        ser.reset_input_buffer()
        for spec in a.audio:
            pcm = load_pcm(spec, a.seconds)
            reference = window_features(pcm)  # integer PCM, exactly what the board gets
            got, frames, micros = board_features(ser, pcm)
            error = np.abs(got - reference) / FLOORS
            worst = int(np.argmax(error))
            passed = bool(np.all(error <= TOLERANCE_FLOORS))
            ok &= passed
            print(f"{Path(spec).name}: {frames} tramas, {micros / frames / 1000:.1f} ms por trama "
                  f"({micros / frames / 1000 / 32.0:.0%} del tiempo real) -> "
                  f"{'IGUAL' if passed else 'DIFERENTE'}; peor: {FEATURE_NAMES[worst]} "
                  f"python={reference[worst]:.4f} placa={got[worst]:.4f} ({error[worst]:.4f} de piso)")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

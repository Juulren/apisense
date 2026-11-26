"""Writes the app's own sound, so it needs no download and carries no license.

Run from the repository root: python scripts/make-sounds.py
"""

import math
import struct
import wave
from pathlib import Path

RATE = 44100
PEAK = 0.16  # quiet on purpose


def note(frequency: float, seconds: float) -> list[float]:
    total = int(RATE * seconds)
    attack = int(RATE * 0.006)
    samples = []
    for i in range(total):
        # A soft start, then it fades out: no click at either end.
        rise = min(1.0, i / attack)
        fade = math.exp(-5.0 * i / total) * (1 - i / total)
        samples.append(PEAK * rise * fade * math.sin(2 * math.pi * frequency * i / RATE))
    return samples


def main() -> None:
    target = Path("assets/sounds/done.wav")
    target.parent.mkdir(parents=True, exist_ok=True)
    samples = note(659.25, 0.07) + note(880.0, 0.13)
    with wave.open(str(target), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(RATE)
        out.writeframes(b"".join(struct.pack("<h", int(s * 32767)) for s in samples))
    print(target, target.stat().st_size, "bytes")


if __name__ == "__main__":
    main()

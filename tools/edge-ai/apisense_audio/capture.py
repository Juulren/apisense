"""Record hive audio from the capture board (or from a saved stream) to WAV files.

    python -m apisense_audio.capture --port COM4 --hive C-01 --minutes 5 --out data/raw
    python -m apisense_audio.capture --from-file stream.bin --hive C-01 --out data/raw

Each WAV gets a JSON sidecar with the hive, the start time (UTC), the sample
rate, per-file damage counters and every stretch that was lost.

Timing rules:
  * A small loss (up to 10 s of blocks) is filled with silence so the audio
    stays aligned, and listed in the sidecar as a gap (split across files when
    it spans more than one).
  * A bigger jump, or the sequence number going backwards (the board restarted,
    the cable was unplugged, the laptop slept), is a discontinuity: the current
    file is closed and the next one starts with the computer's clock. Silence is
    never invented for time the board was not recording.
  * The computer's arrival times are stored too, so a wrong sample rate or drift
    shows up as blocks_per_second far from 62.5.
"""
from __future__ import annotations

import argparse
import json
import wave
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Callable, Iterable, Iterator

import numpy as np

from .features import SAMPLE_RATE
from .framing import StreamDecoder

BLOCK_SAMPLES = 256  # what the firmware sends
MAX_FILL_BLOCKS = 625  # 10 s; larger jumps are restarts or outages, not loss to paper over


def _write_wav(path: Path, samples: np.ndarray, sample_rate: int) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sample_rate)
        w.writeframes(np.asarray(samples, dtype="<i2").tobytes())


def record(chunks: Iterable[bytes], out_dir: Path, hive: str, chunk_seconds: int = 300,
           sample_rate: int = SAMPLE_RATE, started_at: datetime | None = None,
           temperature_c: float | None = None, notes: str = "", firmware: str = "capture-inmp441-v1",
           max_files: int | None = None,
           now: Callable[[], datetime] | None = None) -> list[Path]:
    """Decode a byte stream into WAV + JSON files of `chunk_seconds` each."""
    now = now or (lambda: datetime.now(timezone.utc))
    out_dir.mkdir(parents=True, exist_ok=True)
    decoder = StreamDecoder(expected_samples=BLOCK_SAMPLES)
    per_file = chunk_seconds * sample_rate
    written: list[Path] = []
    pending: list[np.ndarray] = []
    held = 0
    gaps: list[tuple[int, int]] = []  # (start sample, length) relative to the start of `pending`
    clock = started_at or now()
    base = {"blocks": 0, "lost_blocks": 0, "bad_crc": 0, "skipped_bytes": 0}
    host_first: datetime | None = None
    host_last: datetime | None = None
    blocks_in_file = 0
    after_discontinuity = False
    last_seq: int | None = None
    done = False

    def snapshot() -> dict:
        s = decoder.stats
        return {"blocks": s.blocks, "lost_blocks": s.lost_blocks, "bad_crc": s.bad_crc, "skipped_bytes": s.skipped_bytes}

    def flush(final: bool = False) -> None:
        nonlocal pending, held, gaps, clock, base, host_first, host_last, blocks_in_file, after_discontinuity
        if not held or (held < per_file and not final):
            return
        data = np.concatenate(pending)
        take = data if final else data[:per_file]
        rest = np.empty(0, dtype="<i2") if final else data[per_file:]
        file_gaps, carry = [], []
        for start, length in gaps:
            end = start + length
            a, b = max(start, 0), min(end, take.size)
            if b > a:
                file_gaps.append({"at_sample": a, "samples": b - a, "blocks": round((b - a) / BLOCK_SAMPLES)})
            if end > take.size:
                s = max(start, take.size)
                carry.append((s - take.size, end - s))
        now_stats = snapshot()
        delta = {k: now_stats[k] - base[k] for k in base}
        total = delta["blocks"] + delta["lost_blocks"]
        span = (host_last - host_first).total_seconds() if host_first and host_last else 0
        stem = clock.strftime("%Y%m%dT%H%M%SZ") + "_" + hive
        wav = out_dir / (stem + ".wav")
        _write_wav(wav, take, sample_rate)
        (out_dir / (stem + ".json")).write_text(json.dumps({
            "hive": hive, "started_at": clock.isoformat(), "sample_rate": sample_rate,
            "samples": int(take.size), "temperature_c": temperature_c, "notes": notes,
            "firmware": firmware, "gaps": file_gaps,
            "started_after_discontinuity": after_discontinuity,
            "stream": {**delta, "lost_percent": round(100 * delta["lost_blocks"] / total, 3) if total else 0.0},
            "host": {
                "first_block_at": host_first.isoformat() if host_first else None,
                "last_block_at": host_last.isoformat() if host_last else None,
                # About 62.5 for a 16 kHz stream of 256-sample blocks; far from it means a wrong rate or a stalled link.
                "blocks_per_second": round((blocks_in_file - 1) / span, 2) if span > 0 and blocks_in_file > 1 else None,
            },
        }, indent=2))
        written.append(wav)
        clock = clock + timedelta(seconds=take.size / sample_rate)
        pending, held, gaps = ([rest] if rest.size else []), int(rest.size), carry
        base = now_stats
        host_first = host_last if rest.size else None
        blocks_in_file = 0
        after_discontinuity = False

    try:
        for chunk in chunks:
            arrived = now()
            for block in decoder.feed(chunk):
                if last_seq is not None and block.seq != ((last_seq + 1) & 0xFFFF):
                    missing = (block.seq - last_seq - 1) & 0xFFFF
                    if 0 < missing <= MAX_FILL_BLOCKS:
                        gaps.append((held, missing * block.samples.size))
                        pending.append(np.zeros(missing * block.samples.size, dtype="<i2"))
                        held += missing * block.samples.size
                    else:
                        # Restart, unplug, sleep or an implausible jump: close the file; do not invent audio.
                        flush(final=True)
                        clock, after_discontinuity = arrived, True
                last_seq = block.seq
                host_first = host_first or arrived
                host_last = arrived
                blocks_in_file += 1
                pending.append(block.samples)
                held += block.samples.size
                while held >= per_file:
                    flush()
                    if max_files and len(written) >= max_files:
                        done = True
                        return written
    finally:
        if not done:
            flush(final=True)
    return written


def _serial_chunks(port: str, baud: int) -> Iterator[bytes]:
    try:
        import serial  # type: ignore
    except ImportError as error:  # pragma: no cover - needs hardware
        raise SystemExit("Instala pyserial: pip install pyserial") from error
    with serial.Serial(port, baud, timeout=1) as link:  # pragma: no cover - needs hardware
        while True:
            data = link.read(4096)
            if data:
                yield data


def main(argv: list[str] | None = None) -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    src = p.add_mutually_exclusive_group(required=True)
    src.add_argument("--port", help="serial port, e.g. COM4")
    src.add_argument("--from-file", type=Path, help="a saved raw stream instead of a port")
    p.add_argument("--baud", type=int, default=921600)
    p.add_argument("--hive", required=True, help="hive code, e.g. C-01")
    p.add_argument("--out", type=Path, default=Path("data/raw"))
    p.add_argument("--minutes", type=float, default=5, help="length of each file")
    p.add_argument("--temperature", type=float, default=None, help="outside temperature in C, if known")
    p.add_argument("--notes", default="")
    p.add_argument("--max-files", type=int, default=None)
    a = p.parse_args(argv)
    if a.from_file:
        chunks: Iterable[bytes] = iter([a.from_file.read_bytes()])
    else:
        chunks = _serial_chunks(a.port, a.baud)
    try:
        files = record(chunks, a.out, a.hive, int(a.minutes * 60), temperature_c=a.temperature,
                       notes=a.notes, max_files=a.max_files)
    except KeyboardInterrupt:  # the partial file was already saved by record()
        print("\nDetenido: el último archivo parcial quedó guardado.")
        return
    print(f"{len(files)} archivo(s) en {a.out}")


if __name__ == "__main__":
    main()

"""Wire format between the capture firmware (ESP32 + INMP441) and the PC.

The board streams 16-bit mono PCM over USB serial. Serial links drop and
corrupt bytes, so the audio is cut into small blocks, each with a sequence
number and a CRC-16. The decoder finds the next block after any damage and
reports exactly how many blocks were lost, so gaps are known, never guessed.

Block layout (little endian):
    0xA5 0x5A | seq u16 | n u16 | n x int16 samples | crc16 u16
The CRC covers seq, n and the samples (CRC-16/CCITT-FALSE).
"""
from __future__ import annotations

import struct
from dataclasses import dataclass, field

import numpy as np

MAGIC = b"\xa5\x5a"
MAX_SAMPLES = 1024  # sanity bound for a block; the firmware sends 256


def crc16(data: bytes, crc: int = 0xFFFF) -> int:
    for byte in data:
        crc ^= byte << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def encode_block(samples, seq: int) -> bytes:
    pcm = np.asarray(samples, dtype="<i2")
    if not 0 < pcm.size <= MAX_SAMPLES:
        raise ValueError("a block holds 1 to %d samples" % MAX_SAMPLES)
    body = struct.pack("<HH", seq & 0xFFFF, pcm.size) + pcm.tobytes()
    return MAGIC + body + struct.pack("<H", crc16(body))


@dataclass
class Block:
    seq: int
    samples: np.ndarray


@dataclass
class StreamStats:
    blocks: int = 0
    lost_blocks: int = 0
    bad_crc: int = 0
    skipped_bytes: int = 0


@dataclass
class StreamDecoder:
    """Feed it bytes as they arrive; it returns the blocks that completed."""

    # If set, only blocks of exactly this many samples are accepted: a fake magic inside
    # the audio then needs the right length *and* a matching CRC to be taken for a block.
    expected_samples: int | None = None
    stats: StreamStats = field(default_factory=StreamStats)
    _buffer: bytearray = field(default_factory=bytearray)
    _last_seq: int | None = None

    def feed(self, data: bytes) -> list[Block]:
        self._buffer += data
        out: list[Block] = []
        while True:
            start = self._buffer.find(MAGIC)
            if start < 0:
                # Keep a trailing 0xA5: it may be the first half of a magic.
                keep = 1 if self._buffer.endswith(MAGIC[:1]) else 0
                self.stats.skipped_bytes += max(0, len(self._buffer) - keep)
                del self._buffer[: len(self._buffer) - keep]
                break
            if start:
                self.stats.skipped_bytes += start
                del self._buffer[:start]
            if len(self._buffer) < 6:
                break
            seq, n = struct.unpack_from("<HH", self._buffer, 2)
            if not 0 < n <= MAX_SAMPLES or (self.expected_samples and n != self.expected_samples):
                self.stats.skipped_bytes += 1
                del self._buffer[:1]
                continue
            total = 2 + 4 + 2 * n + 2
            if len(self._buffer) < total:
                break
            body = bytes(self._buffer[2 : 6 + 2 * n])
            (crc,) = struct.unpack_from("<H", self._buffer, 6 + 2 * n)
            if crc16(body) != crc:
                # Damaged: drop only the magic so a real block inside is still found.
                self.stats.bad_crc += 1
                self.stats.skipped_bytes += 1
                del self._buffer[:1]
                continue
            if self._last_seq is not None:
                gap = (seq - self._last_seq - 1) & 0xFFFF
                # A huge "gap" is a restart or a stale counter, not 60 000 lost blocks.
                if 0 < gap < 0x8000:
                    self.stats.lost_blocks += gap
            self._last_seq = seq
            self.stats.blocks += 1
            out.append(Block(seq, np.frombuffer(bytes(self._buffer[6 : 6 + 2 * n]), dtype="<i2").copy()))
            del self._buffer[:total]
        return out

import struct
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apisense_audio.datasets import parse_wav, resample  # noqa: E402
from apisense_audio.phase_a import _auc, leave_one_group_out  # noqa: E402


def wav_bytes(samples: bytes, tag: int, bits: int, rate: int, channels: int = 1) -> bytes:
    block = channels * bits // 8
    fmt = struct.pack("<HHIIHH", tag, channels, rate, rate * block, block, bits)
    body = b"WAVE" + b"fmt " + struct.pack("<I", 16) + fmt + b"data" + struct.pack("<I", len(samples)) + samples
    return b"RIFF" + struct.pack("<I", len(body)) + body


class ParseWav(unittest.TestCase):
    def test_float32_and_int16_give_the_same_signal(self):
        x = np.sin(np.linspace(0, 40, 800)).astype("<f4") * 0.5
        as_int = np.round(x * 32768).astype("<i2")
        a, rate_a = parse_wav(wav_bytes(x.tobytes(), 3, 32, 22050))
        b, rate_b = parse_wav(wav_bytes(as_int.tobytes(), 1, 16, 22050))
        self.assertEqual((rate_a, rate_b), (22050, 22050))
        self.assertLess(np.max(np.abs(a - b)), 1e-3)

    def test_stereo_is_averaged_to_mono(self):
        left = np.full(100, 8000, dtype="<i2")
        right = np.full(100, -8000, dtype="<i2")
        pairs = np.stack([left, right], axis=1).tobytes()
        x, _ = parse_wav(wav_bytes(pairs, 1, 16, 16000, channels=2))
        self.assertEqual(x.size, 100)
        self.assertLess(np.max(np.abs(x)), 1e-9)

    def test_24_bit_samples(self):
        values = [0, 1 << 22, -(1 << 22), (1 << 23) - 1]
        raw = b"".join((v & 0xFFFFFF).to_bytes(3, "little") for v in values)
        x, _ = parse_wav(wav_bytes(raw, 1, 24, 16000))
        self.assertAlmostEqual(x[1], 0.5, places=5)
        self.assertAlmostEqual(x[2], -0.5, places=5)

    def test_rejects_other_files(self):
        with self.assertRaises(ValueError):
            parse_wav(b"not a wav at all")


class Resample(unittest.TestCase):
    def test_keeps_a_tone_at_its_frequency(self):
        rate, target = 22050, 16000
        t = np.arange(rate) / rate
        y = resample(np.sin(2 * np.pi * 200 * t), rate, target)
        self.assertEqual(y.size, target)
        peak = np.argmax(np.abs(np.fft.rfft(y)))
        self.assertEqual(peak, 200)
        self.assertAlmostEqual(float(np.max(np.abs(y))), 1.0, places=2)


class Evaluation(unittest.TestCase):
    def test_auc_extremes(self):
        y = np.array([0, 0, 1, 1.0])
        self.assertEqual(_auc(np.array([0.1, 0.2, 0.8, 0.9]), y), 1.0)
        self.assertEqual(_auc(np.array([0.9, 0.8, 0.2, 0.1]), y), 0.0)

    def test_leave_one_group_out_separates_a_real_difference_and_not_noise(self):
        rng = np.random.default_rng(1)
        groups = np.repeat(np.array(["a", "b", "c"]), 200)
        y = np.tile(np.array([0.0, 1.0]), 300)
        signal = rng.normal(size=(600, 5))
        signal[:, 0] += 3 * y
        for g, n, auc, _ in leave_one_group_out(signal, y, groups):
            self.assertGreater(auc, 0.95, g)
        noise = rng.normal(size=(600, 5))
        for g, n, auc, _ in leave_one_group_out(noise, y, groups):
            self.assertLess(abs(auc - 0.5), 0.15, g)


if __name__ == "__main__":
    unittest.main()

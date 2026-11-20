import csv
import json
import sys
import tempfile
import unittest
import wave
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apisense_audio import baseline as bl  # noqa: E402
from apisense_audio.analyze import load_events, load_windows  # noqa: E402
from apisense_audio.capture import record  # noqa: E402
from apisense_audio.evaluate import evaluate  # noqa: E402
from apisense_audio.features import (  # noqa: E402
    FEATURE_NAMES,
    FRAME_FEATURES,
    SAMPLE_RATE,
    frame_features,
    window_features,
    windows_from_audio,
)
from apisense_audio.framing import StreamDecoder, crc16, encode_block  # noqa: E402
from apisense_audio.synthetic import synthetic_audio, synthetic_windows  # noqa: E402

RNG = lambda seed=1: np.random.default_rng(seed)  # noqa: E731
T0 = datetime(2026, 11, 20, 12, 0, tzinfo=timezone.utc)
PER_SECOND = SAMPLE_RATE // 256  # blocks per second


def stream(blocks, start_seq=0, size=256):
    out = b""
    for i in range(blocks):
        out += encode_block(np.full(size, (i % 100) + 1, dtype="<i2"), (start_seq + i) & 0xFFFF)
    return out


class Clock:
    """A fake host clock: each call moves one second ahead."""

    def __init__(self):
        self.t = T0

    def __call__(self):
        self.t += timedelta(seconds=1)
        return self.t


def sidecars(files):
    return [json.loads(f.with_suffix(".json").read_text()) for f in files]


class FramingTests(unittest.TestCase):
    def test_crc_matches_the_standard_check_value(self):
        self.assertEqual(crc16(b"123456789"), 0x29B1)  # CRC-16/CCITT-FALSE

    def test_round_trips_even_one_byte_at_a_time(self):
        data = stream(5)
        d = StreamDecoder()
        got = []
        for byte in data:
            got += d.feed(bytes([byte]))
        self.assertEqual([b.seq for b in got], [0, 1, 2, 3, 4])
        self.assertTrue(all((b.samples == i + 1).all() for i, b in enumerate(got)))
        self.assertEqual(d.stats.lost_blocks, 0)
        self.assertEqual(d.stats.bad_crc, 0)

    def test_a_damaged_block_is_dropped_and_the_next_ones_recovered(self):
        blocks = [encode_block(np.full(256, i, dtype="<i2"), i) for i in range(4)]
        bad = bytearray(blocks[1])
        bad[20] ^= 0xFF
        d = StreamDecoder()
        got = d.feed(b"\x00\x11garbage" + blocks[0] + bytes(bad) + blocks[2] + blocks[3])
        self.assertEqual([b.seq for b in got], [0, 2, 3])
        self.assertEqual(d.stats.bad_crc, 1)
        self.assertEqual(d.stats.lost_blocks, 1)
        self.assertGreater(d.stats.skipped_bytes, 0)

    def test_counts_lost_blocks_across_the_sequence_wrap_but_not_a_restart(self):
        d = StreamDecoder()
        d.feed(encode_block([1] * 8, 65534) + encode_block([1] * 8, 1))
        self.assertEqual(d.stats.lost_blocks, 2)  # 65535 and 0 never arrived
        d.feed(encode_block([1] * 8, 40000))  # a restart is not 40 000 lost blocks
        self.assertEqual(d.stats.lost_blocks, 2)

    def test_rejects_blocks_that_are_empty_or_too_big(self):
        with self.assertRaises(ValueError):
            encode_block([], 0)
        with self.assertRaises(ValueError):
            encode_block([0] * 2000, 0)

    def test_with_an_expected_size_a_block_of_another_length_is_not_taken_for_one(self):
        d = StreamDecoder(expected_samples=256)
        got = d.feed(encode_block([5] * 64, 0) + encode_block([5] * 256, 1))
        self.assertEqual([b.seq for b in got], [1])


class CaptureTests(unittest.TestCase):
    def test_writes_wav_and_sidecar_per_chunk_with_small_gaps_filled_by_silence(self):
        # 100 blocks, 62 missing (about 1 s), then 2 s more: 1 s per file.
        data = stream(100) + stream(2 * PER_SECOND, start_seq=162)
        with tempfile.TemporaryDirectory() as tmp:
            files = record([data[: len(data) // 2], data[len(data) // 2 :]], Path(tmp), "C-01",
                           chunk_seconds=1, started_at=T0, now=Clock())
            meta = sidecars(files)
            self.assertEqual(meta[0]["hive"], "C-01")
            self.assertEqual(meta[0]["started_at"], "2026-11-20T12:00:00+00:00")
            self.assertEqual(meta[1]["started_at"], "2026-11-20T12:00:01+00:00")
            self.assertEqual(sum(g["blocks"] for m in meta for g in m["gaps"]), 62)
            self.assertEqual(sum(m["stream"]["lost_blocks"] for m in meta), 62)
            self.assertEqual(meta[0]["stream"]["bad_crc"], 0)
            with wave.open(str(files[0]), "rb") as w:
                self.assertEqual((w.getnchannels(), w.getsampwidth(), w.getframerate()), (1, 2, SAMPLE_RATE))
                self.assertEqual(w.getnframes(), SAMPLE_RATE)

    def test_a_gap_longer_than_one_file_is_reported_in_every_file_it_touches(self):
        # 3 s of audio, a 4 s hole (250 blocks), then 1 s: files of 1 s -> the hole spans files.
        data = stream(3 * PER_SECOND) + stream(PER_SECOND, start_seq=3 * PER_SECOND + 250)
        with tempfile.TemporaryDirectory() as tmp:
            files = record([data], Path(tmp), "C-01", chunk_seconds=1, started_at=T0, now=Clock())
            meta = sidecars(files)
            per_file = [sum(g["samples"] for g in m["gaps"]) for m in meta]
            self.assertEqual(sum(per_file), 250 * 256)  # every lost sample is accounted for, once
            self.assertGreaterEqual(sum(1 for n in per_file if n), 4)  # 4 s of hole touches at least 4 files
            self.assertTrue(all(n <= SAMPLE_RATE for n in per_file))

    def test_a_board_restart_closes_the_file_and_never_invents_silence(self):
        # seq 40000..40009 then the board reboots: 0..9. The old arithmetic read this as 25 000 lost blocks.
        data = stream(10, start_seq=40000) + stream(10, start_seq=0)
        with tempfile.TemporaryDirectory() as tmp:
            files = record([data[: len(data) // 2], data[len(data) // 2 :]], Path(tmp), "C-01",
                           chunk_seconds=60, started_at=T0, now=Clock())
            meta = sidecars(files)
            self.assertEqual(len(files), 2)
            self.assertEqual([m["samples"] for m in meta], [2560, 2560])
            self.assertEqual([m["gaps"] for m in meta], [[], []])
            self.assertFalse(meta[0]["started_after_discontinuity"])
            self.assertTrue(meta[1]["started_after_discontinuity"])
            first = datetime.fromisoformat(meta[0]["started_at"])
            second = datetime.fromisoformat(meta[1]["started_at"])
            # The second file starts on the computer's clock, not right after the first one's audio.
            self.assertGreater(second, first + timedelta(seconds=1))

    def test_a_long_outage_with_a_forward_jump_is_also_a_discontinuity(self):
        data = stream(5, start_seq=0) + stream(5, start_seq=5 + 2000)  # 2000 blocks (32 s) vanished
        with tempfile.TemporaryDirectory() as tmp:
            files = record([data], Path(tmp), "C-01", chunk_seconds=60, started_at=T0, now=Clock())
            self.assertEqual(len(files), 2)
            self.assertTrue(sidecars(files)[1]["started_after_discontinuity"])

    def test_the_sidecar_has_per_file_counters_loss_percent_and_the_measured_block_rate(self):
        data = stream(100)
        with tempfile.TemporaryDirectory() as tmp:
            files = record([data[i : i + 600] for i in range(0, len(data), 600)], Path(tmp), "C-01",
                           chunk_seconds=60, started_at=T0, now=Clock())
            m = sidecars(files)[0]
            self.assertEqual(m["stream"]["blocks"], 100)
            self.assertEqual(m["stream"]["lost_percent"], 0.0)
            self.assertIsNotNone(m["host"]["first_block_at"])
            self.assertIsNotNone(m["host"]["blocks_per_second"])

    def test_interrupting_the_recording_still_saves_the_partial_file(self):
        def chunks():
            yield stream(30)
            raise KeyboardInterrupt

        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(KeyboardInterrupt):
                record(chunks(), Path(tmp), "C-01", chunk_seconds=60, started_at=T0, now=Clock())
            wavs = list(Path(tmp).glob("*.wav"))
            self.assertEqual(len(wavs), 1)
            with wave.open(str(wavs[0]), "rb") as w:
                self.assertEqual(w.getnframes(), 30 * 256)

    def test_max_files_stops_early(self):
        with tempfile.TemporaryDirectory() as tmp:
            files = record([stream(200)], Path(tmp), "C-02", chunk_seconds=1, max_files=2, now=Clock())
            self.assertEqual(len(files), 2)


class FeatureTests(unittest.TestCase):
    def test_a_125_hz_hum_is_found_and_low_bands_dominate(self):
        x = synthetic_audio(4, RNG(), hour=3)
        f = dict(zip(FRAME_FEATURES, frame_features(x).mean(axis=0)))
        self.assertAlmostEqual(f["dominant_hz"], 125, delta=16)
        self.assertGreater(f["band_100_200_db"], f["band_700_1500_db"] + 10)

    def test_integer_pcm_and_float_audio_give_the_same_features(self):
        x = synthetic_audio(2, RNG(), hour=3)
        pcm = np.round(x * 32768).astype(np.int16)
        a, b = window_features(x), window_features(pcm)
        self.assertTrue(np.allclose(a, b, atol=0.05), np.abs(a - b).max())

    def test_windows_have_one_vector_per_whole_window(self):
        x = synthetic_audio(10, RNG(), hour=12)
        w = windows_from_audio(x, seconds=4)
        self.assertEqual(w.shape, (2, len(FEATURE_NAMES)))
        self.assertEqual(windows_from_audio(x[:100], seconds=4).shape, (0, len(FEATURE_NAMES)))

    def test_a_disturbance_changes_the_features(self):
        base = window_features(synthetic_audio(4, RNG(), hour=12))
        tooting = window_features(synthetic_audio(4, RNG(), hour=12, anomaly="tooting"))
        i = FEATURE_NAMES.index("band_300_450_db_mean")
        self.assertGreater(tooting[i], base[i] + 6)


class BaselineTests(unittest.TestCase):
    def setUp(self):
        self.windows, self.hours, self.day = synthetic_windows(4, 24, RNG(3))

    def test_needs_enough_data_and_the_right_shape(self):
        with self.assertRaises(ValueError):
            bl.HiveBaseline.fit(self.windows[:10], self.hours[:10])
        with self.assertRaises(ValueError):
            bl.HiveBaseline.fit(self.windows[:, :5], self.hours)

    def test_usual_windows_score_low_and_disturbed_ones_high(self):
        model = bl.HiveBaseline.fit(self.windows, self.hours)
        usual = np.mean([model.score(w, h) for w, h in zip(self.windows, self.hours)])
        odd, _, _ = synthetic_windows(1, 4, RNG(9), events=[(0, 3, "broadband")])
        flagged = [model.score(w, 12) > model.threshold for w in odd]
        self.assertLess(usual, model.threshold)
        self.assertTrue(all(flagged))

    def test_saved_baseline_scores_exactly_like_the_original(self):
        model = bl.HiveBaseline.fit(self.windows, self.hours)
        again = bl.HiveBaseline.from_dict(json.loads(model.dumps()))
        for w, h in list(zip(self.windows, self.hours))[:10]:
            self.assertAlmostEqual(model.score(w, h), again.score(w, h), places=9)
        with self.assertRaises(ValueError):
            bl.HiveBaseline.from_dict({"format": "other"})

    def test_hours_map_to_eight_three_hour_buckets(self):
        self.assertEqual([bl.bucket_of(h) for h in (0, 2.9, 3, 5.9, 6, 12, 18, 23.9, 24)], [0, 0, 1, 1, 2, 4, 6, 7, 0])

    def test_each_kind_of_feature_has_its_own_scale_floor(self):
        f = dict(zip(FEATURE_NAMES, bl.FLOORS))
        self.assertEqual(f["band_100_200_db_mean"], 1.0)
        self.assertEqual(f["rms_db_std"], 0.5)
        self.assertLess(f["flatness_mean"], 0.05)  # a 0-1 feature must not get a 0.5 floor
        self.assertGreater(f["dominant_hz_mean"], 20)  # a one-bin flip must not look like a catastrophe

    def test_a_one_bin_jump_of_the_dominant_frequency_is_not_a_false_alarm_by_itself(self):
        model = bl.HiveBaseline.fit(self.windows, self.hours)
        w = self.windows[12].copy()
        w[FEATURE_NAMES.index("dominant_hz_mean")] += 16  # one FFT bin
        self.assertLess(model.score(w, 12), model.threshold)

    def test_alarm_needs_three_of_the_last_four_windows_and_a_reset_forgets_them(self):
        model = bl.HiveBaseline.fit(self.windows, self.hours)
        calm = self.windows[12]
        loud, _, _ = synthetic_windows(1, 4, RNG(9), events=[(0, 3, "broadband")])
        model.threshold = (model.score(calm, 12) + min(model.score(w, 12) for w in loud)) / 2
        det = bl.Detector(model)
        verdicts = [det.update(w, 12)[0] for w in (loud[0], calm, loud[1], loud[2], loud[3])]
        self.assertEqual(verdicts, [0, 0, 0, 1, 1])  # exceed pattern T F T T T
        det.reset()
        self.assertEqual([det.update(w, 12)[0] for w in (loud[0], loud[1])], [0, 0])


class EvaluateTests(unittest.TestCase):
    def test_split_by_day_detects_disturbances_with_few_false_alarms(self):
        per_day = 24
        events = [(6 * per_day + 5, 6 * per_day + 9, "broadband"), (7 * per_day + 14, 7 * per_day + 18, "tooting")]
        windows, hours, day = synthetic_windows(8, per_day, RNG(5), events=events)
        report = evaluate(windows, hours, day, train_days=4, events=[(s, e) for s, e, _ in events])
        self.assertEqual(report.train_days, 4)
        self.assertEqual(report.test_days, 4)
        self.assertEqual(report.events, 2)
        self.assertEqual(report.detection_rate, 1.0)
        self.assertLessEqual(report.false_alarms_per_day, 1.0)
        self.assertTrue(any("Falsas alarmas" in line for line in report.lines()))
        self.assertTrue(any("menos de 10 eventos" in line for line in report.lines()))

    def test_an_event_in_the_training_days_is_left_out_instead_of_aborting_the_analysis(self):
        per_day = 24
        events = [(1 * per_day + 6, 1 * per_day + 9, "broadband"), (6 * per_day + 5, 6 * per_day + 9, "tooting")]
        windows, hours, day = synthetic_windows(8, per_day, RNG(8), events=events)
        report = evaluate(windows, hours, day, train_days=4, events=[(s, e) for s, e, _ in events])
        self.assertEqual((report.events, report.events_ignored), (1, 1))
        self.assertEqual(report.detection_rate, 1.0)
        self.assertTrue(any("se excluyeron" in line for line in report.lines()))

    def test_no_days_left_to_test_is_an_error(self):
        windows, hours, day = synthetic_windows(5, 24, RNG(6))
        with self.assertRaises(ValueError):
            evaluate(windows, hours, day, train_days=5)

    def test_without_labelled_events_there_is_no_detection_rate(self):
        windows, hours, day = synthetic_windows(6, 24, RNG(7))
        report = evaluate(windows, hours, day, train_days=3)
        self.assertIsNone(report.detection_rate)

    def test_the_lagging_alarm_after_an_event_is_not_a_false_alarm(self):
        per_day = 24
        s = 6 * per_day + 5
        windows, hours, day = synthetic_windows(8, per_day, RNG(12), events=[(s, s + 1, "broadband")])
        report = evaluate(windows, hours, day, train_days=4, events=[(s, s + 1)], grace=3)
        self.assertEqual(report.false_alarms_per_day, 0.0)

    def test_recording_gaps_are_not_scored_and_do_not_raise_false_alarms(self):
        per_day = 24
        windows, hours, day = synthetic_windows(8, per_day, RNG(14))
        valid = np.ones(len(windows), dtype=bool)
        windows[6 * per_day + 4 : 6 * per_day + 10] = -120.0  # digital silence from a lost stretch
        valid[6 * per_day + 4 : 6 * per_day + 10] = False
        report = evaluate(windows, hours, day, train_days=4, valid=valid)
        self.assertEqual(report.false_alarms_per_day, 0.0)
        self.assertEqual(report.windows_flagged_pct, 0.0)
        # The same gap without the mask is exactly the false alarm this prevents.
        naive = evaluate(windows, hours, day, train_days=4)
        self.assertGreater(naive.false_alarms_per_day, 0.0)

    def test_false_alarms_are_rated_per_day_of_recorded_time_not_per_day_with_any_window(self):
        per_day = 24
        windows, hours, day = synthetic_windows(6, per_day, RNG(16))
        keep = ~((day == 5) & (np.arange(len(day)) % per_day >= 2))  # day 5 has only two windows
        report = evaluate(windows[keep], hours[keep], day[keep], train_days=4)
        self.assertGreaterEqual(report.test_days, 2)
        self.assertLessEqual(report.false_alarms_per_day, 1.0)


class AnalyzeTests(unittest.TestCase):
    def _write(self, folder, stamp, hive, hour, gaps=None, seconds=8, silent_from=None):
        x = np.round(synthetic_audio(seconds, RNG(hour + 1), hour=hour) * 32768).astype("<i2")
        if silent_from is not None:
            x[silent_from:] = 0
        with wave.open(str(folder / f"{stamp}_{hive}.wav"), "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SAMPLE_RATE)
            w.writeframes(x.tobytes())
        started = datetime.strptime(stamp, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        (folder / f"{stamp}_{hive}.json").write_text(
            json.dumps({"started_at": started.isoformat(), "gaps": gaps or []})
        )

    def test_reads_recordings_in_time_order_with_local_hours_days_and_validity(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            self._write(folder, "20261121T020000Z", "C-01", 2)  # written out of order on purpose
            self._write(folder, "20261120T230000Z", "C-01", 23)
            w = load_windows(folder, "C-01", 4, -6)
            self.assertEqual(w.features.shape, (4, len(FEATURE_NAMES)))
            self.assertEqual(w.starts, sorted(w.starts))
            # 23:00Z is 17:00 in Mérida (UTC-6); 02:00Z the next day is 20:00 on the same local day.
            self.assertEqual(w.hours.tolist(), [17.0, 17.0, 20.0, 20.0])  # minute resolution
            self.assertEqual(w.day.tolist(), [0, 0, 0, 0])
            self.assertEqual(w.valid.tolist(), [True] * 4)
            self.assertEqual(w.run_start.tolist(), [True, False, True, False])  # a 3-hour hole between the files
            with self.assertRaises(SystemExit):
                load_windows(folder, "C-99", 4, -6)

    def test_windows_over_a_gap_or_digital_silence_are_marked_invalid(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            gap = [{"at_sample": 4 * SAMPLE_RATE + 100, "samples": 200, "blocks": 1}]
            self._write(folder, "20261120T120000Z", "C-01", 12, gaps=gap)
            self._write(folder, "20261120T130000Z", "C-01", 13, silent_from=4 * SAMPLE_RATE)
            w = load_windows(folder, "C-01", 4, -6)
            self.assertEqual(w.valid.tolist(), [True, False, True, False])

    def test_events_are_matched_to_windows_naive_times_use_the_local_offset_and_misses_are_counted(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            self._write(folder, "20261120T230000Z", "C-01", 23)
            w = load_windows(folder, "C-01", 4, -6)
            path = folder / "events.csv"
            with path.open("w", newline="", encoding="utf-8") as f:
                out = csv.writer(f)
                out.writerow(["start", "end", "notes"])
                out.writerow(["2026-11-20T17:00:02-06:00", "2026-11-20T17:00:06-06:00", "con zona"])
                out.writerow(["2026-11-20T17:00:02", "2026-11-20T17:00:06", "sin zona = hora local"])
                out.writerow(["2026-11-20T23:00:02Z", "2026-11-20T23:00:06Z", "con Z"])
                out.writerow(["2026-11-25T10:00:00-06:00", "2026-11-25T10:05:00-06:00", "sin grabación"])
            events, missed = load_events(path, w.starts, 4, -6)
            self.assertEqual(events, [(0, 1), (0, 1), (0, 1)])
            self.assertEqual(missed, 1)
            self.assertEqual(load_events(None, w.starts, 4), ([], 0))


if __name__ == "__main__":
    unittest.main()

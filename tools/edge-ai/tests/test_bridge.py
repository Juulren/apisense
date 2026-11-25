import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apisense_audio.bridge import Outbox, decode, describe, parse_uplink, worth_retrying  # noqa: E402
from apisense_audio.uplink_sim import encode, for_status  # noqa: E402

FIXTURE = Path(__file__).resolve().parents[3] / "supabase" / "tests" / "fixtures" / "node_uplinks.json"


class BoardLines(unittest.TestCase):
    def test_reads_the_messages_the_board_produced(self):
        messages = json.loads(FIXTURE.read_text(encoding="utf-8"))["messages"]
        for m in messages:
            self.assertEqual(parse_uplink(f"UPLINK {m['hex']}"), bytes.fromhex(m["hex"]), m["name"])

    def test_ignores_other_and_damaged_lines(self):
        good = encode(1, 0.9, None, None, 3, 0).hex()
        damaged = good[:-2] + f"{int(good[-2:], 16) ^ 1:02x}"
        for line in ["WINDOW estado=2", "UPLINK", f"UPLINK {good[:-2]}", f"UPLINK {damaged}", "UPLINK zz" + good[2:], ""]:
            self.assertIsNone(parse_uplink(line), line)

    def test_describes_what_the_node_said(self):
        self.assertEqual(describe(decode(for_status(2, 0, 1.0, 5.0, 0))), "sonido habitual")
        self.assertEqual(describe(decode(for_status(2, 1, 9.0, 5.0, 1))), "sonido DIFERENTE")
        self.assertEqual(describe(decode(for_status(1, 0, 0.0, 0.0, 2))), "aún no juzga")
        self.assertEqual(describe(decode(for_status(0, 0, 0.0, 0.0, 3, 2))), "aún no juzga · falla del micrófono")


class Sending(unittest.TestCase):
    def test_retries_outages_but_not_refusals(self):
        for answer in ["sin conexión: timed out", "500 {}", "503 x", "429 x"]:
            self.assertTrue(worth_retrying(answer), answer)
        for answer in ["401 unauthorized", "400 x"]:
            self.assertFalse(worth_retrying(answer), answer)

    def test_keeps_order_counter_and_time_through_an_outage(self):
        online = [False]
        got = []

        def post(payload, f_cnt, at):
            if not online[0]:
                return False, "sin conexión: x"
            got.append((f_cnt, at))
            return True, "200 stored"

        box = Outbox(post, limit=3)
        for n in range(4):
            box.add(b"x", n, f"t{n}")
        box.flush(0, say=lambda _: None)
        online[0] = True
        box.flush(1, say=lambda _: None)  # too soon after the failure
        self.assertEqual(got, [])
        box.flush(61, say=lambda _: None)
        self.assertEqual(got, [(1, "t1"), (2, "t2"), (3, "t3")])  # the oldest fell off the limit
        self.assertEqual((box.sent, len(box.waiting)), (3, 0))


if __name__ == "__main__":
    unittest.main()

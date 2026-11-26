import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from apisense_audio.bridge import (  # noqa: E402
    Outbox,
    ask_secret,
    board_ports,
    decode,
    describe,
    parse_uplink,
    secret_problem,
    secret_verdict,
    worth_retrying,
)
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


class FindingTheBoard(unittest.TestCase):
    def test_picks_esp32_usb_chips_and_ignores_other_ports(self):
        class Port:
            def __init__(self, device, vid):
                self.device, self.vid = device, vid

        ports = [Port("COM1", None), Port("COM7", 0x1A86), Port("COM3", 0x10C4), Port("COM9", 0x046D)]
        self.assertEqual(board_ports(ports), ["COM3", "COM7"])
        self.assertEqual(board_ports([Port("COM1", None)]), [])


class CheckingTheSecret(unittest.TestCase):
    def test_rejects_what_a_bad_paste_leaves_behind(self):
        self.assertIsNone(secret_problem("abcDEF123+/xyz="))
        for bad in ["\x16", "\x16abc=", "abc\tdef", "abc\x7f", "contraseña"]:
            self.assertIsNotNone(secret_problem(bad), repr(bad))

    def test_reads_the_answer_to_an_empty_message(self):
        # The function checks the secret first and only then the body: an empty body can store nothing.
        self.assertEqual(secret_verdict('400 {"error":"invalid_shape"}'), "ok")
        self.assertEqual(secret_verdict('401 {"error":"unauthorized"}'), "wrong")
        for answer in ["400 ", "404 x", '500 {"error":"not_configured"}', "sin conexión: x"]:
            self.assertEqual(secret_verdict(answer), "unknown", answer)

    def ask(self, typed, answers, tries=3):
        typed, answers, checked, said = list(typed), list(answers), [], []

        def check(secret):
            checked.append(secret)
            return answers.pop(0)

        return ask_secret(lambda: typed.pop(0), check, said.append, tries), checked, " | ".join(said)

    def test_asks_again_until_the_server_accepts_it(self):
        secret, checked, said = self.ask(
            ["\x16", "malo", " bueno= "], ['401 {"error":"unauthorized"}', '400 {"error":"invalid_shape"}'])
        self.assertEqual(secret, "bueno=")
        self.assertEqual(checked, ["malo", "bueno="])  # the damaged paste never left the PC
        self.assertIn("clic derecho", said)

    def test_gives_up_after_the_tries(self):
        secret, checked, _ = self.ask(["", "\x16", "malo"], ['401 {"error":"unauthorized"}'])
        self.assertIsNone(secret)
        self.assertEqual(checked, ["malo"])

    def test_goes_on_without_internet_but_not_after_a_refusal(self):
        self.assertEqual(self.ask(["s="], ["sin conexión: x"])[0], "s=")
        secret, checked, _ = self.ask(["s=", "t="], ["404 x"])
        self.assertIsNone(secret)
        self.assertEqual(checked, ["s="])  # a wrong address is not fixed by typing again


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

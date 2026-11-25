"""USB bridge for the node while there is no radio: it gives the board the time, shows what it hears and
decides, and can forward its messages to `lora-uplink` as The Things Stack would.

    python -m apisense_audio.bridge --port COM3                       # only watch (nothing is sent anywhere)
    python -m apisense_audio.bridge --port COM3 --url https://<ref>.supabase.co/functions/v1/lora-uplink \
        --dev-eui 70b3d57ed0000001 --yes-store-real-rows             # secret in the UPLINK_SECRET variable

With --port auto it waits for the board and finds it again after unplugging. conectar_nodo.cmd does all of
this with a double click. Flash firmware/apisense_node first. Needs pyserial. Opening the port restarts the board; it then asks for
the time and the bridge answers. Stop with Ctrl+C.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys
import time
from collections import deque
from datetime import datetime
from pathlib import Path

from .uplink_sim import FLAG_MIC_FAULT, FLAG_NOT_JUDGING, crc8, now_iso, post_uplink, secure_opener

TIME_EVERY_S = 3600  # the board's clock drifts a little; a small correction does not drop an alarm
QUEUE_MAX = 1500  # messages kept while there is no internet (about 10 days at one every 10 minutes)
RETRY_EVERY_S = 60


# USB-serial chips found on ESP32 boards: Silicon Labs CP210x, WCH CH340/CH9102, Espressif's own USB.
BOARD_USB_IDS = {0x10C4, 0x1A86, 0x303A}


def board_ports(ports) -> list[str]:
    """The serial ports that look like an ESP32 board (`ports` as list_ports.comports() gives them)."""
    return sorted(p.device for p in ports if getattr(p, "vid", None) in BOARD_USB_IDS)


def worth_retrying(answer: str) -> bool:
    """No connection or a server-side failure can be fixed by trying again; a refusal (4xx) cannot."""
    first = answer.split(" ", 1)[0]
    return not first.isdigit() or first.startswith("5") or first == "429"


class Outbox:
    """Messages waiting to reach the server, oldest first. Each keeps its counter and the time it was heard.
    They are held in memory: closing the bridge loses the ones still waiting (the log keeps them)."""

    def __init__(self, post, limit: int = QUEUE_MAX):
        self.post = post  # post(payload, f_cnt, received_at) -> (ok, answer)
        self.waiting: deque = deque(maxlen=limit)
        self.sent = self.refused = 0
        self.next_try = 0.0

    def add(self, payload: bytes, f_cnt: int, received_at: str) -> None:
        self.waiting.append((payload, f_cnt, received_at))

    def flush(self, now: float, say=print) -> None:
        if now < self.next_try:
            return
        while self.waiting:
            ok, answer = self.post(*self.waiting[0])
            say(f"servidor: {answer}")
            if ok:
                self.sent += 1
            elif worth_retrying(answer):
                self.next_try = now + RETRY_EVERY_S
                say(f"se reintentará; en espera: {len(self.waiting)}")
                return
            else:
                self.refused += 1
            self.waiting.popleft()


def decode(message: bytes) -> dict:
    if len(message) != 8:
        raise ValueError("el mensaje debe medir 8 bytes")
    if crc8(message[:7]) != message[7]:
        raise ValueError("suma de verificación incorrecta")
    flags = message[6] >> 4
    return {
        "class_code": message[1],
        "confidence": message[2] / 255,
        "counter": message[6] & 0x0F,
        "flags": flags,
        "not_judging": bool(flags & FLAG_NOT_JUDGING),
        "mic_fault": bool(flags & FLAG_MIC_FAULT),
    }


def describe(info: dict) -> str:
    names = {0: "sonido habitual", 1: "sonido DIFERENTE"}  # class map 1; see docs/AMPLIAR_CATEGORIAS.md
    if info["not_judging"]:
        text = "aún no juzga"
    else:
        text = names.get(info["class_code"], f"categoría {info['class_code']}")
    if info["mic_fault"]:
        text += " · falla del micrófono"
    return text


def parse_uplink(line: str) -> bytes | None:
    """The 8 bytes of an `UPLINK <hex>` line, or None for any other line (including a damaged one)."""
    parts = line.split()
    if len(parts) != 2 or parts[0] != "UPLINK" or len(parts[1]) != 16:
        return None
    try:
        message = bytes.fromhex(parts[1])
        decode(message)
    except ValueError:
        return None
    return message


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", required=True, help="COM port, or 'auto' to find the board and wait for it")
    ap.add_argument("--url", help="lora-uplink address; without it nothing leaves this PC")
    ap.add_argument("--dev-eui")
    ap.add_argument("--secret-env", default="UPLINK_SECRET")
    ap.add_argument("--yes-store-real-rows", action="store_true",
                    help="required with --url: messages are STORED in the project and may send push notifications")
    ap.add_argument("--seconds", type=int, default=0, help="stop after this time (0 = until Ctrl+C)")
    ap.add_argument("--log", help="append every line from the board to this file")
    ap.add_argument("--reset-learning", action="store_true", help="make the node forget what it learned, then watch")
    a = ap.parse_args()

    secret = None
    if a.url:
        if not a.url.startswith("https://") or not a.dev_eui:
            print("--url debe ser https y necesita --dev-eui")
            return 2
        if not a.yes_store_real_rows:
            print("Con --url cada mensaje se GUARDA en tu proyecto y puede mandar avisos. Añade --yes-store-real-rows.")
            return 2
        secret = os.environ.get(a.secret_env)
        if not secret and sys.stdin.isatty():
            secret = getpass.getpass("Secreto del puente (no se muestra ni se guarda): ").strip()
        if not secret:
            print(f"falta la variable de entorno {a.secret_env}")
            return 2

    import serial  # pip install pyserial

    opener = secure_opener()
    session = f"bridge-{int(time.time())}"  # a new session per run, so counters never collide with an older run
    outbox = Outbox(lambda payload, n, at: post_uplink(opener, a.url, secret, payload, a.dev_eui, n, session, at))
    f_cnt = 0
    log = None
    if a.log:
        Path(a.log).parent.mkdir(parents=True, exist_ok=True)
        log = open(a.log, "a", encoding="utf-8")
    started = time.time()
    reset_pending = a.reset_learning
    opened_once = False

    def running() -> bool:
        return not a.seconds or time.time() - started < a.seconds

    def show(text: str) -> None:
        stamp = datetime.now().strftime("%H:%M:%S")
        print(f"{stamp} {text}", flush=True)
        if log:
            log.write(f"{stamp} {text}\n")
            log.flush()

    def watch(ser) -> None:
        nonlocal f_cnt, reset_pending
        timed_at = time.time() - TIME_EVERY_S + 5  # give the time shortly after connecting, asked or not
        while running():
            if time.time() - timed_at >= TIME_EVERY_S:
                ser.write(f"TIME {int(time.time())}\n".encode())
                timed_at = time.time()
            if a.url:
                outbox.flush(time.time(), show)
            line = ser.readline().decode("utf-8", "replace").strip()
            if not line:
                continue
            show(line)
            if line == "NEEDTIME":
                if reset_pending:
                    ser.write(b"RESET\n")
                    reset_pending = False
                ser.write(f"TIME {int(time.time())}\n".encode())
                timed_at = time.time()
                continue
            message = parse_uplink(line)
            if message is None:
                continue
            show(f"  -> {describe(decode(message))}")
            if a.url:
                outbox.add(message, f_cnt, now_iso())
                f_cnt += 1

    said_waiting = False

    def find_port() -> str | None:
        """The port to open now, or None while there is no single board plugged in (auto mode)."""
        nonlocal said_waiting
        if a.port != "auto":
            return a.port
        from serial.tools import list_ports

        found = board_ports(list_ports.comports())
        if len(found) == 1:
            said_waiting = False
            return found[0]
        if not said_waiting:
            show("esperando la placa: conéctala por USB" if not found else
                 f"hay varias placas ({', '.join(found)}): deja una sola o usa --port")
            said_waiting = True
        return None

    try:
        while running():
            port = find_port()
            if port is None:
                if a.url:
                    outbox.flush(time.time(), show)
                time.sleep(2)
                continue
            try:
                ser = serial.Serial()
                ser.port, ser.baudrate, ser.timeout = port, 921600, 1
                if opened_once:
                    ser.dtr = ser.rts = False  # reconnecting must not restart the board
                ser.open()
                opened_once = True
                show(f"conectado en {port}")
                with ser:
                    watch(ser)
            except serial.SerialException as e:
                if not opened_once and a.port != "auto":
                    print(f"no se pudo abrir {port}: {e}")
                    return 1
                show(f"puerto perdido u ocupado ({e}); reintento en 5 s")
                if a.url:
                    outbox.flush(time.time(), show)  # what was already heard still goes out
                time.sleep(5)
    except KeyboardInterrupt:
        pass
    finally:
        if log:
            log.close()
    if a.url:
        print(f"enviados: {outbox.sent} · rechazados: {outbox.refused} · sin enviar: {len(outbox.waiting)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

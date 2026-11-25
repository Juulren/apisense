"""Phase D on the PC: the node's 8-byte message, and a simulated gateway that posts it to `lora-uplink`.

    python -m apisense_audio.uplink_sim check --port COM3 [--fixture supabase/tests/fixtures/node_uplinks.json]
    python -m apisense_audio.uplink_sim send  --url https://<project>.supabase.co/functions/v1/lora-uplink \
        --secret-env UPLINK_SECRET --dev-eui 70b3d57ed0000001 --kind usual --count 3

`check` needs the learn_test sketch on the board: it asks the board's C++ encoder for a set of messages, compares
every byte with an independent Python encoder (the contract in supabase/functions/_shared/edgePayload.ts) and
can write them to a fixture that the app's tests decode and push through the real `lora-uplink` handler.

`send` pretends to be The Things Stack: it posts a TTN v3 uplink webhook with the shared secret. Use it only
against a project you own, with a DevEUI that is linked to a hive in the app. The secret is read from an
environment variable, never from the command line.
"""
from __future__ import annotations

import argparse
import base64
import json
import math
import os
import struct
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

FLAG_SD_FULL, FLAG_MIC_FAULT, FLAG_LOW_BATTERY, FLAG_NOT_JUDGING = 1, 2, 4, 8


def crc8(data: bytes) -> int:
    crc = 0
    for byte in data:
        crc ^= byte
        for _ in range(8):
            crc = ((crc << 1) ^ 0x07) & 0xFF if crc & 0x80 else (crc << 1) & 0xFF
    return crc


def _round(x: float) -> int:
    return math.floor(x + 0.5)  # JavaScript's Math.round


def encode(class_code=0, confidence=0.0, temperature=None, battery=None, counter=0, flags=0) -> bytes:
    """Independent reference of encodeEdgePayload (format 1, class map 1)."""
    body = bytearray(7)
    body[0] = 0x11
    body[1] = class_code & 0xFF
    body[2] = max(0, min(255, _round(confidence * 255))) if math.isfinite(confidence) else 0
    # The server rejects the whole message outside -40..85 C, so the node sends "no sensor" instead.
    if temperature is not None and not (math.isfinite(temperature) and -40.0 <= temperature <= 85.0):
        temperature = None
    if battery is not None and not math.isfinite(battery):
        battery = None
    temp = 0x8000 if temperature is None else _round(temperature * 100) & 0xFFFF
    body[3], body[4] = temp >> 8, temp & 0xFF
    body[5] = 0xFF if battery is None else max(0, min(254, _round((battery - 2) * 100)))
    body[6] = ((flags & 0x0F) << 4) | (counter & 0x0F)
    return bytes(body) + bytes([crc8(bytes(body))])


def for_status(status: int, alarm: int, score: float, threshold: float, counter: int, extra_flags: int = 0) -> bytes:
    """Reference of uplinkFor(): not judging unless the node is ready (status 2)."""
    flags = extra_flags & 0x07
    if status != 2:
        return encode(0, 0.0, None, None, counter, flags | FLAG_NOT_JUDGING)
    margin = min(1.0, abs(score - threshold) / threshold) if threshold > 0 else 0.0
    return encode(1 if alarm else 0, 0.5 + 0.5 * margin, None, None, counter, flags)


def ttn_body(payload: bytes, dev_eui: str, f_cnt: int, session: str = "AXsimulator0001") -> dict:
    return {
        "end_device_ids": {"dev_eui": dev_eui.upper()},
        "received_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "uplink_message": {
            "f_port": 1,
            "f_cnt": f_cnt,
            "frm_payload": base64.b64encode(payload).decode(),
            "session_key_id": session,
        },
    }


def _board_encode(ser, case: dict) -> bytes:
    msg = struct.pack(
        "<BfBfBfBB",
        case["class"], case["confidence"],
        1 if case["temperature"] is not None else 0, case["temperature"] or 0.0,
        1 if case["battery"] is not None else 0, case["battery"] or 0.0,
        case["counter"], case["flags"],
    )
    ser.reset_input_buffer()
    ser.write(b"\xa5\x6c" + msg)
    return _board_reply(ser)


def _board_status(ser, status, alarm, score, threshold, counter, extra) -> bytes:
    ser.reset_input_buffer()
    ser.write(b"\xa5\x6e" + struct.pack("<BBffBB", status, alarm, score, threshold, counter, extra))
    return _board_reply(ser)


def _board_reply(ser) -> bytes:
    head = ser.read(2)
    for _ in range(64):
        if head == b"\xa5\x6d":
            return ser.read(8)
        head = head[1:] + ser.read(1)
    raise RuntimeError("sin respuesta de la placa (¿está cargado learn_test?)")


ENCODER_CASES = [
    dict(name="habitual", **{"class": 0, "confidence": 1.0, "temperature": 25.0, "battery": 3.9, "counter": 3, "flags": 0}),
    dict(name="diferente", **{"class": 1, "confidence": 0.8, "temperature": 27.35, "battery": 3.9, "counter": 5, "flags": 4}),
    dict(name="temperatura negativa", **{"class": 0, "confidence": 0.5, "temperature": -3.5, "battery": 3.3, "counter": 15, "flags": 0}),
    dict(name="sin sensores", **{"class": 0, "confidence": 0.93, "temperature": None, "battery": None, "counter": 0, "flags": 3}),
    dict(name="no juzga", **{"class": 0, "confidence": 0.0, "temperature": None, "battery": 4.2, "counter": 9, "flags": 8}),
    dict(name="sonda suelta -127", **{"class": 0, "confidence": 0.9, "temperature": -127.0, "battery": 3.7, "counter": 2, "flags": 0}),
    dict(name="temperatura sobre 85", **{"class": 1, "confidence": 0.9, "temperature": 90.0, "battery": 3.7, "counter": 3, "flags": 0}),
    dict(name="valores no numericos", **{"class": 0, "confidence": float("nan"), "temperature": float("nan"), "battery": float("nan"), "counter": 4, "flags": 0}),
    dict(name="bateria al tope", **{"class": 1, "confidence": 1.2, "temperature": 85.0, "battery": 9.0, "counter": 17, "flags": 31}),
]
STATUS_CASES = [  # status, alarm, score, threshold, counter, extra flags
    ("aprendiendo", 1, 0, 0.0, 0.0, 1, 0),
    ("sin reloj", 0, 0, 0.0, 0.0, 2, 4),
    ("listo habitual", 2, 0, 1.5, 5.0, 3, 0),
    ("listo diferente", 2, 1, 8.0, 5.0, 4, 1),
    ("listo en el umbral", 2, 1, 5.0, 5.0, 5, 0),
]


def check(port: str, fixture: str | None) -> int:
    import serial

    failed = 0
    cases = []
    with serial.Serial(port, 921600, timeout=5) as ser:
        import time

        time.sleep(2.5)
        ser.reset_input_buffer()
        for case in ENCODER_CASES:
            want = encode(case["class"], case["confidence"], case["temperature"], case["battery"], case["counter"], case["flags"])
            got = _board_encode(ser, case)
            ok = got == want
            failed += not ok
            print(f"  {'OK    ' if ok else 'FALLO '}{case['name']}: placa {got.hex()} python {want.hex()}")
            cases.append({"name": case["name"], "hex": got.hex()})
        for name, status, alarm, score, threshold, counter, extra in STATUS_CASES:
            want = for_status(status, alarm, score, threshold, counter, extra)
            got = _board_status(ser, status, alarm, score, threshold, counter, extra)
            ok = got == want
            failed += not ok
            print(f"  {'OK    ' if ok else 'FALLO '}{name}: placa {got.hex()} python {want.hex()}")
            cases.append({"name": name, "hex": got.hex()})
    contract = bytes([0x11, 0x00, 0xFF, 0x09, 0xC4, 0xBE, 0x03])
    ok = crc8(b"123456789") == 0xF4 and encode(0, 1.0, 25.0, 3.9, 3, 0) == contract + bytes([crc8(contract)])
    failed += not ok
    print(f"  {'OK    ' if ok else 'FALLO '}secuencia fija del contrato de edgePayload.test.ts")
    if fixture and not failed:
        Path(fixture).parent.mkdir(parents=True, exist_ok=True)
        Path(fixture).write_text(json.dumps({"source": "mensajes calculados por el codificador C++ en la placa", "messages": cases}, indent=2) + "\n", encoding="utf-8")
        print(f"fixture escrito: {fixture}")
    print("TODO IGUAL" if not failed else f"{failed} FALLARON")
    return 1 if failed else 0


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Never follow a redirect: it would carry the secret header to whatever address answers."""

    def redirect_request(self, *args, **kwargs):
        return None


def send(url: str, secret: str, dev_eui: str, kind: str, count: int, start: int, session: str) -> int:
    if not url.startswith("https://"):
        print("la dirección debe ser https")
        return 2
    opener = urllib.request.build_opener(_NoRedirect)
    code = {"usual": 0, "different": 1, "learning": 0}[kind]
    flags = FLAG_NOT_JUDGING if kind == "learning" else 0
    status = 0
    for i in range(count):
        n = start + i
        payload = encode(code, 0.93 if kind != "learning" else 0.0, 27.4, 3.86, n, flags)
        data = json.dumps(ttn_body(payload, dev_eui, n, session)).encode()
        request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json", "x-uplink-secret": secret})
        try:
            with opener.open(request, timeout=20) as r:
                print(n, r.status, r.read().decode()[:200])  # "duplicate" = that counter was already sent
        except urllib.error.HTTPError as e:
            print(n, e.code, e.read().decode()[:200])
            status = 1
        except urllib.error.URLError as e:
            print(n, "sin conexión:", e.reason)
            status = 1
    return status


def main() -> int:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check")
    c.add_argument("--port", required=True)
    c.add_argument("--fixture")
    s = sub.add_parser("send")
    s.add_argument("--url", required=True)
    s.add_argument("--secret-env", default="UPLINK_SECRET")
    s.add_argument("--dev-eui", required=True)
    s.add_argument("--kind", choices=["usual", "different", "learning"], default="usual")
    s.add_argument("--count", type=int, default=1)
    s.add_argument("--start", type=int, default=0, help="first uplink counter; use a new --session (or start) on each run")
    s.add_argument("--session", default="AXsimulator0001")
    s.add_argument("--yes-store-real-rows", action="store_true",
                   help="required: the messages are STORED in the project (and may send push notifications to its user)")
    a = ap.parse_args()
    if a.cmd == "check":
        return check(a.port, a.fixture)
    if not a.yes_store_real_rows:
        print(f"Esto guarda {a.count} veredicto(s) de verdad en {a.url.split('/')[2] if '//' in a.url else a.url} y puede mandar "
              "avisos al dueño de la colmena. Repite con --yes-store-real-rows si es tu proyecto.")
        return 2
    secret = os.environ.get(a.secret_env)
    if not secret:
        print(f"falta la variable de entorno {a.secret_env}")
        return 2
    return send(a.url, secret, a.dev_eui, a.kind, a.count, a.start, a.session)


if __name__ == "__main__":
    sys.exit(main())

"""Reject the native Button layout regression, using Android's actual bounds."""
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

tree = ET.parse(sys.argv[1])
metrics = Path(sys.argv[2]).read_text()
densities = re.findall(r"(?:Physical|Override) density:\s*(\d+)", metrics)
if not densities:
    raise SystemExit("Missing Android density; cannot evaluate dp bounds")
density = int(densities[-1]) / 160
buttons = [n for n in tree.iter("node")
           if n.get("content-desc") == "Entrar al Apiario"]
if len(buttons) != 1:
    raise SystemExit("Primary catalog button is not uniquely visible")
button = buttons[0]
left, top, right, bottom = map(int, re.findall(r"\d+", button.get("bounds", "")))
if bottom - top < 52 * density - 1:
    raise SystemExit("Primary button lost its 52dp native style/touch target")
if button.get("clickable") != "true" or button.get("enabled") != "true":
    raise SystemExit("Primary catalog button is not actionable")
print("Native primary control: >=52dp, enabled and clickable: OK")

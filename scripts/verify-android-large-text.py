"""Check actual native large-text geometry; this does not certify TalkBack."""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

tree = ET.parse(sys.argv[1])
metrics = Path(sys.argv[2]).read_text()
density = int(re.findall(r"(?:Physical|Override) density:\s*(\d+)", metrics)[-1]) / 160
nodes = list(tree.iter("node"))


def unique(attribute, value):
    found = [n for n in nodes if n.get(attribute) == value]
    if len(found) != 1:
        raise SystemExit(f"Expected one native control: {value}")
    return found[0]


def bounds(node):
    return tuple(map(int, re.findall(r"\d+", node.get("bounds", ""))))


def intersects(a, b):
    return max(a[0], b[0]) < min(a[2], b[2]) and max(a[1], b[1]) < min(a[3], b[3])


sync = unique("content-desc", "Ver estado de sincronización")
for label in ["Apisense", "Apiario"]:
    if intersects(bounds(unique("text", label)), bounds(sync)):
        raise SystemExit(f"Large-text header overlaps sync action: {label}")

controls = []
selected = 0
for label in ["Inicio", "Acústica", "Diagnóstico", "Ajustes"]:
    node = unique("resource-id", f"nav-{label}")
    if node.get("content-desc") != label or node.get("clickable") != "true" or node.get("enabled") != "true" or node.get("focusable") != "true":
        raise SystemExit(f"Native navigation label/action missing: {label}")
    left, top, right, bottom = bounds(node)
    if min(right-left, bottom-top) < 48*density-1:
        raise SystemExit(f"Navigation touch target below 48dp: {label}")
    selected += node.get("selected") == "true"
    controls.append({"label": label, "bounds_px": [left, top, right, bottom], "selected": node.get("selected") == "true"})
if selected != 1:
    raise SystemExit("Exactly one native navigation item must be selected")

save = unique("content-desc", "Guardar observación")
left, top, right, bottom = bounds(save)
if bottom-top < 52*density-1 or save.get("enabled") != "true" or save.get("clickable") != "true":
    raise SystemExit("Large-text save action lost its native touch target/state")
print(json.dumps({"header_overlap": False, "navigation": controls, "save_height_dp": (bottom-top)/density, "limits": "Native attributes/geometry only; physical TalkBack announcements and focus order pending"}, ensure_ascii=False, indent=2))

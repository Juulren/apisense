"""Verify archived Stitch sources against the authenticated canvas capture.

Python 3 standard library only. Does not execute the captured HTML or scripts.
This proves source identity and integrity, not the app's visual fidelity.
"""

import argparse
import gzip
import hashlib
from html.parser import HTMLParser
import io
import json
from pathlib import Path
import re
import struct
import zipfile


SCREEN_IDS = {
    "4ddc4e1cd1d94c95bc9a96bd4506140d",
    "0b3c11bfb4874a0bbf758415fde95bc0",
    "81a455bf1b6546dcb69422fb93eb9815",
    "2866b2f10dd941b1b45449c881f2f906",
    "9219c95b429f4b69b120299875a6a659",
    "8b522e6fd6c4496c8b4322ffa25359cb",
    "594626aefe1d4d62be0199116b847dc8",
    "15f5ffbe4079404d9e31504985a22c57",
    "075860fb08504a389181206213e52cbf",
    "0e200552364542faa7ee9ae0a15069c5",
    "5c34c4004aba4e95b023dbc433532e0a",
}
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}


class CanvasBody(HTMLParser):
    """Normalize only documented preview additions and insignificant whitespace."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens = []
        self.skip = 0
        self.in_body = False
        self.complete = False

    def handle_starttag(self, tag, attrs):
        if tag == "body":
            self.in_body = True
        if self.skip:
            if tag not in VOID:
                self.skip += 1
            return
        attributes = dict(attrs)
        if "data-stitch-injected" in attributes:
            if tag not in VOID:
                self.skip = 1
            return
        if not self.in_body:
            return
        # Stitch records its viewport-class substitution on the same element.
        if "data-stitch-vh" in attributes:
            observed, original = attributes["data-stitch-vh"].split("===")
            attributes["class"] = attributes.get("class", "").replace(observed, original)
        for key in list(attributes):
            if key.startswith("data-stitch"):
                del attributes[key]
        self.tokens.append(["start", tag, [[key, value] for key, value in sorted(attributes.items())]])

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if self.skip:
            if tag not in VOID:
                self.skip -= 1
            return
        if self.in_body:
            self.tokens.append(["end", tag])
        if tag == "body":
            self.in_body = False
            self.complete = True

    def handle_data(self, data):
        if self.in_body and not self.skip:
            value = re.sub(r"\s+", " ", data).strip()
            if value:
                self.tokens.append(["text", value])


def body_tokens(source):
    parser = CanvasBody()
    parser.feed(source)
    if not parser.complete or parser.skip or not parser.tokens:
        raise ValueError("Incomplete HTML body evidence")
    return parser.tokens


def digest(data):
    return hashlib.sha256(data).hexdigest()


def body_digest(tokens):
    return digest(json.dumps(tokens, ensure_ascii=False, separators=(",", ":")).encode("utf-8"))


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify(root, archive=None):
    base = root / "design-reference/stitch"
    manifest = json.loads((base / "manifest.json").read_text(encoding="utf-8"))
    evidence = manifest["verification"]
    compressed = (base / evidence["capture_file"]).read_bytes()
    require(digest(compressed) == evidence["capture_sha256"], "Canvas capture checksum changed")
    with gzip.GzipFile(fileobj=io.BytesIO(compressed)) as stream:
        payload = stream.read(8_000_001)
    require(len(payload) <= 8_000_000, "Canvas capture exceeds the size limit")
    capture = json.loads(payload)
    require(capture["project_id"] == manifest["project_id"] == "14657518597972503903",
            "Unexpected Stitch project")
    screens = manifest["screens"]
    observed = capture["screens"]
    require(manifest["verified_screen_ids"] is True, "Manifest is not marked verified")
    require(len(screens) == len(observed) == 11, "Exactly 11 screens are required")
    require({s["id"] for s in screens} == {s["id"] for s in observed} == SCREEN_IDS,
            "Missing, duplicate, or unexpected screen IDs")
    require(len({s["export_directory"] for s in screens}) == 11, "Exports must map one to one")
    require(len({s["body_sha256"] for s in screens}) == 11, "Body mappings must be unique")
    expected_files = {s["export_directory"] + "/" + name
                      for s in screens for name in ("code.html", "screen.png")}
    expected_files.add("exports/pastel_precision_biotech/DESIGN.md")
    require(len(manifest["files"]) == 23 and
            {f["path"] for f in manifest["files"]} == expected_files,
            "The 23 original archive entries must be preserved")
    for entry in manifest["files"]:
        require(digest((base / entry["path"]).read_bytes()) == entry["sha256"],
                "Archived file changed: " + entry["path"])
    by_id = {s["id"]: s for s in observed}
    for screen in screens:
        directory = base / screen["export_directory"]
        local = body_tokens((directory / "code.html").read_text(encoding="utf-8"))
        remote = by_id[screen["id"]]["normalized_body_tokens"]
        require(local == remote, "Canvas/export body mismatch: " + screen["id"])
        require(body_digest(remote) == screen["body_sha256"], "Body checksum changed: " + screen["id"])
        png = (directory / "screen.png").read_bytes()
        require(png[:8] == b"\x89PNG\r\n\x1a\n", "Invalid PNG: " + screen["id"])
        require(list(struct.unpack(">II", png[16:24])) == screen["png_dimensions"],
                "PNG dimensions changed: " + screen["id"])
        print(screen["id"], "->", screen["family"], screen["theme"], "OK")
    if archive:
        require(digest(archive.read_bytes()) == evidence["original_archive_sha256"],
                "Unexpected original ZIP")
        with zipfile.ZipFile(archive) as zipped:
            for entry in manifest["files"]:
                suffix = "/".join(Path(entry["path"]).parts[1:])
                matches = [n for n in zipped.namelist() if n.endswith(suffix)]
                require(len(matches) == 1, "Missing or ambiguous ZIP entry: " + suffix)
                require(digest(zipped.read(matches[0])) == entry["sha256"],
                        "ZIP file mismatch: " + suffix)
        print("Original ZIP: all 23 archived files match")
    print("Verified 11/11 IDs, 11 HTML/PNG pairs, and 23 archived checksums.")
    print("Source verification only; app visual fidelity is a separate review.")


if __name__ == "__main__":
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--archive", type=Path, help="Optional original user-provided ZIP")
    args = cli.parse_args()
    verify(Path(__file__).resolve().parent.parent, args.archive)

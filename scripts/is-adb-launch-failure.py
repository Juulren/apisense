"""Recognize a pre-action transport failure, without printing flow secrets."""
import json
import sys
from pathlib import Path

files = list(Path(sys.argv[1]).rglob("commands.json"))
if len(files) != 1:
    sys.exit(1)
commands = json.loads(files[0].read_text(encoding="utf-8"))
failures = [c for c in commands if c.get("metadata", {}).get("status") == "FAILED"]
safe = bool(failures) and all(
    "launchAppCommand" in c.get("command", {})
    and "device offline" in c["metadata"].get("error", {}).get("message", "").lower()
    for c in failures
)
# No tap, input, write or assertion may have completed before that failure.
safe = safe and all(
    set(c.get("command", {})) <= {"defineVariablesCommand", "applyConfigurationCommand", "launchAppCommand"}
    for c in commands
)
if not safe:
    sys.exit(1)
print("ADB transport lost before app launch; retrying once without resetting data.")

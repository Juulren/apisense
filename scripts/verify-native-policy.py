"""Inspect packaged manifests; never consume project credentials."""
import plistlib
import sys
import xml.etree.ElementTree as ET

platform, filename = sys.argv[1:3]
expected_package = sys.argv[3] if len(sys.argv) > 3 else None
if platform == "android":
    root = ET.parse(filename).getroot()
    if expected_package:
        assert root.get("package") == expected_package, "Unexpected Android application ID"
    ns = "{http://schemas.android.com/apk/res/android}"
    app = root.find("application")
    assert app is not None
    assert app.get(ns + "allowBackup") == "false", "Android backup must be disabled"
    assert app.get(ns + "usesCleartextTraffic") == "false", "Release must reject cleartext"
    assert app.get(ns + "debuggable", "false") == "false", "Release must not be debuggable"
    forbidden = {"android.permission.RECORD_AUDIO", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"}
    permissions = {p.get(ns + "name") for p in root.findall("uses-permission") + root.findall("uses-permission-sdk-23")}
    assert not forbidden & permissions, "Unexpected microphone or external storage permission"
    assert "android.permission.BLUETOOTH_SCAN" in permissions
    assert "android.permission.BLUETOOTH_CONNECT" in permissions
elif platform == "ios":
    with open(filename, "rb") as source:
        info = plistlib.load(source)
    assert info.get("NSAppTransportSecurity", {}).get("NSAllowsArbitraryLoads") is False
    assert info.get("UIFileSharingEnabled") is False
    assert info.get("LSSupportsOpeningDocumentsInPlace") is False
    assert "NSMicrophoneUsageDescription" not in info
    assert info.get("NSBluetoothAlwaysUsageDescription")
else:
    raise ValueError("Use android or ios")
print(f"Packaged {platform} security policy: OK")

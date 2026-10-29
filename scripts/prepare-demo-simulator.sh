#!/usr/bin/env bash
set -euo pipefail
# Only the generated CI simulator demo project is changed. Xcode embeds these
# simulator entitlements while linking; a post-build device-style signature
# does not replace that step. No Apple account or device profile is used here.
python3 - <<'PY'
import plistlib
from pathlib import Path
path = Path('ios/ApisenseDemo/ApisenseDemo.entitlements')
with path.open('rb') as source:
    entitlements = plistlib.load(source)
entitlements.update({
    'application-identifier': 'com.apisense.demo',
    'keychain-access-groups': ['com.apisense.demo'],
})
with path.open('wb') as target:
    plistlib.dump(entitlements, target)
PY

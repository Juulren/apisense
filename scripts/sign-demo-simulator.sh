#!/usr/bin/env bash
set -euo pipefail
app_path=".artifacts/ios-app/ApisenseDemo.app"
# This identity is only for the simulator demo. It is not Apple device signing.
bundle_id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Info.plist")
platform=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleSupportedPlatforms:0' "$app_path/Info.plist")
if [ "$bundle_id" != 'com.apisense.demo' ] || [ "$platform" != 'iPhoneSimulator' ]; then
  echo 'Only the Apisense demo simulator bundle can be signed by this script.' >&2
  exit 1
fi
# CODE_SIGNING_ALLOWED=NO omits the identity Keychain needs (-34018).
# Restore the simulator app identity using an ad-hoc signature, with no account,
# certificate, provisioning profile, or plaintext storage fallback.
python3 - <<'PY'
import plistlib
with open('.artifacts/ios-simulator-entitlements.plist', 'wb') as target:
    plistlib.dump({
        'application-identifier': 'com.apisense.demo',
        'keychain-access-groups': ['com.apisense.demo'],
    }, target)
PY
codesign --force --sign - --timestamp=none --entitlements .artifacts/ios-simulator-entitlements.plist "$app_path"
codesign --verify --deep --strict "$app_path"
codesign -d --entitlements - "$app_path"
ditto -c -k --sequesterRsrc --keepParent "$app_path" .artifacts/ApisenseDemo-simulator.zip

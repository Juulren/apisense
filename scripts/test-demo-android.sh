#!/usr/bin/env bash
set -euo pipefail
mkdir -p .artifacts
trap 'task_status=$?; adb logcat -d > .artifacts/android-logcat.log || true; exit "$task_status"' EXIT
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell pm clear com.apisense.demo
adb shell svc wifi disable
adb shell svc data disable
if [ "${EXPO_PUBLIC_SECURITY_QA:-0}" = "1" ]; then
  "$HOME/.maestro/bin/maestro" test --format junit --output .artifacts/android-security.xml --test-output-dir .artifacts/android-security-maestro .maestro/security.yaml
fi
"$HOME/.maestro/bin/maestro" test --format junit --output .artifacts/android-demo.xml --test-output-dir .artifacts/android-maestro .maestro/demo.yaml

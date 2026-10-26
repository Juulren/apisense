#!/usr/bin/env bash
set -euo pipefail
mkdir -p .artifacts
trap 'task_status=$?; adb logcat -d > .artifacts/android-logcat.log || true; exit "$task_status"' EXIT
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell svc wifi disable
adb shell svc data disable
"$HOME/.maestro/bin/maestro" test --format junit --output .artifacts/android-demo.xml --test-output-dir .artifacts/android-maestro .maestro/demo.yaml

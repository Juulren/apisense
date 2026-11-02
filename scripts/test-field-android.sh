#!/usr/bin/env bash
set -euo pipefail
: "${MAESTRO_QA_A_EMAIL:?Prepare disposable QA accounts first}"
: "${MAESTRO_QA_A_PASSWORD:?Missing temporary account A}"
: "${MAESTRO_QA_B_EMAIL:?Missing temporary account B}"
: "${MAESTRO_QA_B_PASSWORD:?Missing temporary account B}"
: "${MAESTRO_QA_NOTE:?Missing run marker}"
mkdir -p .artifacts
trap 'task_status=$?; adb logcat -d > .artifacts/android-field-logcat.log || true; exit "$task_status"' EXIT
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell pm clear com.apisense.app
# This flow intentionally tests the field app against Supabase, not demo mode.
adb shell svc wifi enable
"$HOME/.maestro/bin/maestro" test --format junit --output .artifacts/android-field.xml --test-output-dir .artifacts/android-field-maestro .maestro/field.yaml
adb shell svc wifi disable
adb shell svc data disable
"$HOME/.maestro/bin/maestro" test --format junit --output .artifacts/android-field-offline.xml --test-output-dir .artifacts/android-field-offline-maestro .maestro/field-offline.yaml
adb shell svc wifi enable
"$HOME/.maestro/bin/maestro" test --format junit --output .artifacts/android-field-sync.xml --test-output-dir .artifacts/android-field-sync-maestro .maestro/field-sync.yaml

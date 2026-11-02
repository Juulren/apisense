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
run_phase() {
  local phase="$1" flow="$2"
  if "$HOME/.maestro/bin/maestro" test --format junit --output ".artifacts/$phase.xml" --test-output-dir ".artifacts/$phase-maestro" "$flow"; then
    return 0
  fi
  # Retry once ONLY when ADB loses the device at launch, before flow actions.
  # Keep the failed transport report; assertions and application errors fail CI.
  python3 scripts/is-adb-launch-failure.py ".artifacts/$phase-maestro" || return 1
  cp ".artifacts/$phase.xml" ".artifacts/$phase-transport.xml"
  adb reconnect offline
  timeout 45 adb wait-for-device
  "$HOME/.maestro/bin/maestro" test --format junit --output ".artifacts/$phase.xml" --test-output-dir ".artifacts/$phase-maestro-retry" "$flow"
}
run_phase android-field .maestro/field.yaml
adb shell svc wifi disable
adb shell svc data disable
run_phase android-field-offline .maestro/field-offline.yaml
adb shell svc wifi enable
run_phase android-field-sync .maestro/field-sync.yaml

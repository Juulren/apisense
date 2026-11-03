#!/usr/bin/env bash
set -euo pipefail
serial=$(adb get-serialno)
if [[ "${CI:-}" != "1" || "$serial" != emulator-* ]]; then
  echo 'El recorrido visual solo puede reiniciar la app en un emulador desechable de CI.' >&2
  exit 1
fi
scope=${APISENSE_DESIGN_SCOPE:-all}
[[ "$scope" == all || "$scope" == extended ]] || { echo 'Unknown design scope' >&2; exit 1; }
mkdir -p .artifacts/design/light .artifacts/design/dark
printf '%s\n' "$scope" > .artifacts/design/scope.txt
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell pm clear com.apisense.app
adb shell svc wifi disable
adb shell svc data disable
# The Google APIs cold-boot launcher can leave an ANR dialog over our app.
# Stop only that emulator launcher; never dismiss an Apisense crash/ANR.
adb shell am force-stop com.google.android.apps.nexuslauncher
adb shell wm size > .artifacts/design/viewport.txt
adb shell wm density >> .artifacts/design/viewport.txt
adb shell getprop ro.build.version.sdk >> .artifacts/design/viewport.txt
trap 'adb shell settings put system font_scale 1.0 || true; adb logcat -d > .artifacts/design/logcat.log || true' EXIT
device_date=$(adb shell date +%F | tr -d '\r')
cycle_start=$(python3 -c 'from datetime import date,timedelta; import sys; print(date.fromisoformat(sys.argv[1])-timedelta(days=15))' "$device_date")
cycle_due_start=$(python3 -c 'from datetime import date,timedelta; import sys; print(date.fromisoformat(sys.argv[1])-timedelta(days=20))' "$device_date")
run_design_phase() {
  local phase="$1" flow="$2"
  shift 2
  if "$HOME/.maestro/bin/maestro" test "$@" --format junit --output ".artifacts/design/$phase.xml" --test-output-dir ".artifacts/design/$phase/maestro" "$flow"; then
    return 0
  fi
  # Retry only a proven device-offline transport loss before any app action.
  # The existing recognizer rejects assertions, taps, writes and app errors.
  python3 scripts/is-adb-launch-failure.py ".artifacts/design/$phase/maestro" || return 1
  cp ".artifacts/design/$phase.xml" ".artifacts/design/$phase-transport.xml"
  adb reconnect offline
  timeout 45 adb wait-for-device
  "$HOME/.maestro/bin/maestro" test "$@" --format junit --output ".artifacts/design/$phase.xml" --test-output-dir ".artifacts/design/$phase/maestro-retry" "$flow"
}
if [[ "$scope" == all ]]; then
for theme in light dark; do
  label=Claro
  [[ "$theme" == dark ]] && label=Oscuro
  "$HOME/.maestro/bin/maestro" test -e THEME_LABEL="$label" -e THEME_KEY="$theme" \
    --format junit --output ".artifacts/design/$theme.xml" \
    --test-output-dir ".artifacts/design/$theme/maestro" .maestro/design.yaml
  adb shell uiautomator dump /sdcard/apisense-design-controls.xml
  adb pull /sdcard/apisense-design-controls.xml ".artifacts/design/$theme-controls.xml"
  python3 scripts/verify-android-design.py ".artifacts/design/$theme-controls.xml" ".artifacts/design/viewport.txt"
done
"$HOME/.maestro/bin/maestro" test -e CYCLE_START="$cycle_start" \
  --format junit --output .artifacts/design/functional.xml \
  --test-output-dir .artifacts/design/functional/maestro .maestro/hive-cycle.yaml
adb shell settings put system font_scale 1.5
adb shell am force-stop com.apisense.app
trap 'adb shell settings put system font_scale 1.0 || true; adb logcat -d > .artifacts/design/logcat.log || true' EXIT
adb shell settings get system font_scale > .artifacts/design/font-scale.txt
"$HOME/.maestro/bin/maestro" test -e CYCLE_DUE_START="$cycle_due_start" \
  --format junit --output .artifacts/design/large-font.xml \
  --test-output-dir .artifacts/design/large-font/maestro .maestro/hive-large-font.yaml
adb shell uiautomator dump /sdcard/apisense-large-font.xml
adb pull /sdcard/apisense-large-font.xml .artifacts/design/large-font-controls.xml

fi

# Additional state/volume regressions use the same isolated synthetic workspace.
adb shell settings put system font_scale 1.0
adb shell am force-stop com.apisense.app
run_design_phase extended .maestro/extended-hives.yaml -e CYCLE_START="$cycle_start"
run_design_phase states .maestro/extended-states.yaml

adb shell settings put system font_scale 2.0
adb shell am force-stop com.apisense.app
adb shell settings get system font_scale > .artifacts/design/font200-scale.txt
run_design_phase font200 .maestro/extended-font.yaml
adb shell uiautomator dump /sdcard/apisense-font200.xml
adb pull /sdcard/apisense-font200.xml .artifacts/design/font200-controls.xml
adb shell settings put system font_scale 1.0

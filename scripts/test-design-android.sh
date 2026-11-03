#!/usr/bin/env bash
set -euo pipefail
serial=$(adb get-serialno)
if [[ "${CI:-}" != "1" || "$serial" != emulator-* ]]; then
  echo 'El recorrido visual solo puede reiniciar la app en un emulador desechable de CI.' >&2
  exit 1
fi
mkdir -p .artifacts/design/light .artifacts/design/dark
adb install -r android/app/build/outputs/apk/release/app-release.apk
adb shell pm clear com.apisense.app
adb shell svc wifi disable
adb shell svc data disable
adb shell wm size > .artifacts/design/viewport.txt
adb shell wm density >> .artifacts/design/viewport.txt
adb shell getprop ro.build.version.sdk >> .artifacts/design/viewport.txt
trap 'adb logcat -d > .artifacts/design/logcat.log || true' EXIT
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

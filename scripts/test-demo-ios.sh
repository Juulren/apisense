#!/usr/bin/env bash
set -euo pipefail
device_id="$1"
mkdir -p .artifacts
collect_diagnostics() {
  task_status=$?
  if [ "$task_status" -ne 0 ]; then
    "$HOME/.maestro/bin/maestro" --device "$device_id" test --test-output-dir .artifacts/ios-diagnostics .maestro/ios-failure.yaml || true
  fi
  xcrun simctl spawn "$device_id" log show --last 10m --style compact --predicate 'process == "ApisenseDemo" OR process == "securityd"' > .artifacts/ios-runtime.log 2>&1 || true
  exit "$task_status"
}
trap collect_diagnostics EXIT
xcrun simctl install "$device_id" .artifacts/ios-app/ApisenseDemo.app
"$HOME/.maestro/bin/maestro" --device "$device_id" test --format junit --output .artifacts/ios-demo.xml --test-output-dir .artifacts/ios-maestro .maestro/demo.yaml

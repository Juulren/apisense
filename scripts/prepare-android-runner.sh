#!/usr/bin/env bash
set -euo pipefail
if [[ "${GITHUB_ACTIONS:-}" != true || "${RUNNER_OS:-}" != Linux || "${RUNNER_ENVIRONMENT:-}" != github-hosted ]]; then
  echo 'La preparación de disco solo está permitida en un runner Linux desechable de GitHub.' >&2
  exit 1
fi
# These preinstalled toolchains are unused by the Android/Node/Java job.
# Keep the Android SDK, Node, Java and Gradle caches intact.
sudo rm -rf -- /usr/share/dotnet /opt/ghc /usr/local/.ghcup /opt/hostedtoolcache/CodeQL
df -h /

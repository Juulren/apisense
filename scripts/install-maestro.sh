#!/usr/bin/env bash
set -euo pipefail
version="${MAESTRO_VERSION:-cli-2.12.0}"
base="https://github.com/mobile-dev-inc/Maestro/releases/download/$version"
workdir="$(mktemp -d)"
curl --fail --location --retry 3 "$base/maestro.zip" --output "$workdir/maestro.zip"
curl --fail --location --retry 3 "$base/checksums_sha256.txt" --output "$workdir/checksums_sha256.txt"
(
  cd "$workdir"
  if command -v sha256sum >/dev/null; then
    sha256sum --check checksums_sha256.txt
  else
    shasum -a 256 --check checksums_sha256.txt
  fi
)
unzip -q "$workdir/maestro.zip" -d "$workdir"
mkdir -p "$HOME/.maestro"
cp -R "$workdir/maestro/." "$HOME/.maestro/"
chmod +x "$HOME/.maestro/bin/maestro"
"$HOME/.maestro/bin/maestro" --version

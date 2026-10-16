#!/usr/bin/env bash
# Downloads the Grafana plugin validator binary from its GitHub release.
# Since v0.42 the validator is tagged as plugin-validator/vX.Y.Z, which the
# Go module proxy does not resolve, so `go install` is not an option.
# Usage: install-plugincheck2.sh <version> <target path>
set -euo pipefail

version="$1"
target="$2"

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
arch="$(uname -m)"
case "$arch" in
  x86_64) arch=amd64 ;;
  aarch64 | arm64) arch=arm64 ;;
esac

release_url="${PLUGINCHECK2_RELEASE_URL:-https://github.com/grafana/plugin-validator/releases/download/plugin-validator%2F${version}}"
archive="plugin-validator_${version#v}_${os}_${arch}.tar.gz"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading ${release_url}/${archive}"
curl -sSfL -o "$tmp/$archive" "${release_url}/${archive}"
curl -sSfL -o "$tmp/checksums.txt" "${release_url}/checksums.txt"
(cd "$tmp" && grep " ${archive}\$" checksums.txt | shasum -a 256 -c -)

tar -xzf "$tmp/$archive" -C "$tmp" plugincheck2
mkdir -p "$(dirname "$target")"
mv "$tmp/plugincheck2" "$target"

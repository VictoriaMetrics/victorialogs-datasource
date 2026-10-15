#!/usr/bin/env bash
# Runs only the vulnerability analyzer of the Grafana plugin validator on the
# lockfiles in the repository root, exactly as the Grafana plugin catalog does
# on publish. The analyzer needs no build, but plugincheck2 refuses to start
# without a plugin archive, so a stub archive with plugin.json stands in.
# Usage: plugin-vuln-check.sh <plugincheck2 binary> <plugin id>
set -euo pipefail

plugincheck2="$1"
plugin_id="$2"
repo="$PWD"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

mkdir -p "$tmp/$plugin_id"
cp "$repo/src/plugin.json" "$tmp/$plugin_id/"
(cd "$tmp" && zip -q -r stub.zip "$plugin_id")

"$plugincheck2" -analyzer osv-scanner -sourceCodeUri "file://$repo/" "$tmp/stub.zip" \
  2>&1 | tee "$tmp/plugincheck2.log"

# plugincheck2 reports a scan that could not reach the OSV API as passed and
# only logs the failure, so the log is checked for errors explicitly. The match
# is case-insensitive and word-bounded to cover every log format in use.
if grep -Eqi '\berror\b' "$tmp/plugincheck2.log"; then
  echo "The vulnerability scan is incomplete, see the errors above" >&2
  exit 1
fi

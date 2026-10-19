#!/usr/bin/env bash
# Rewrites PLUGINCHECK2_VERSION in the Makefile of the current directory to the
# latest Grafana plugin validator release.
# Usage: plugincheck2-update.sh <current version>
set -euo pipefail

current="$1"

# sed below exits 0 even when nothing matches, so the line is checked explicitly.
if ! grep -q '^PLUGINCHECK2_VERSION = ' Makefile; then
  echo "PLUGINCHECK2_VERSION line not found in Makefile" >&2
  exit 1
fi

latest="$("$(dirname "$0")/plugincheck2-latest-version.sh")"

if [ "$current" = "$latest" ]; then
  echo "plugincheck2 ${current} is the latest release"
  exit 0
fi

# -i.bak works with both GNU and BSD sed.
sed -i.bak "s/^PLUGINCHECK2_VERSION = .*/PLUGINCHECK2_VERSION = ${latest}/" Makefile
rm Makefile.bak
echo "Updated plugincheck2 from ${current} to ${latest}"

#!/usr/bin/env bash
# Rewrites PLUGINCHECK2_VERSION in the Makefile of the current directory to the
# latest Grafana plugin validator release.
# Usage: plugincheck2-update.sh <current version>
set -euo pipefail

current="$1"
latest="$("$(dirname "$0")/plugincheck2-latest-version.sh")"

if [ "$current" = "$latest" ]; then
  echo "plugincheck2 ${current} is the latest release"
  exit 0
fi

# -i.bak works with both GNU and BSD sed.
sed -i.bak "s/^PLUGINCHECK2_VERSION = .*/PLUGINCHECK2_VERSION = ${latest}/" Makefile
rm Makefile.bak
echo "Updated plugincheck2 from ${current} to ${latest}"

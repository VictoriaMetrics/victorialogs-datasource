#!/usr/bin/env bash
# Prints the newest stable release of the Grafana plugin validator, e.g. v0.51.0.
# The repository also releases other components (e.g. mcp/vX.Y.Z), so only tags
# with the plugin-validator/ prefix count. GH_TOKEN, when set, authenticates the
# request to stay clear of the anonymous rate limit.
set -euo pipefail

releases_url="https://api.github.com/repos/grafana/plugin-validator/releases?per_page=100"
tag_prefix="plugin-validator/"

fetch_releases() {
  if [ -n "${GH_TOKEN:-}" ]; then
    curl -sSfL -H "Authorization: Bearer ${GH_TOKEN}" "$releases_url"
  else
    curl -sSfL "$releases_url"
  fi
}

# Releases come newest first, so the first stable one with the prefix is the latest.
latest="$(fetch_releases | jq -r --arg prefix "$tag_prefix" '
  first(
    .[]
    | select(.draft | not)
    | select(.prerelease | not)
    | .tag_name
    | select(startswith($prefix))
    | ltrimstr($prefix)
  )
')"

if [ -z "$latest" ]; then
  echo "No stable ${tag_prefix}v* release found" >&2
  exit 1
fi

echo "$latest"

#!/usr/bin/env bash
# Opens or refreshes the pull request that bumps the Grafana plugin validator
# to its latest release. Meant for CI: git must be configured to sign commits
# and GH_TOKEN must allow pushing the upgrade branch and managing pull requests.
set -euo pipefail

cd "$(dirname "$0")/.."

base=main
branch=plugin-validator-update

# A manual dispatch from another branch would carry its commits into the PR.
if [ "$(git rev-parse --abbrev-ref HEAD)" != "$base" ]; then
  echo "the upgrade must be proposed from ${base}" >&2
  exit 1
fi

make plugincheck2-update
if git diff --quiet Makefile; then
  exit 0
fi
version="$(sed -n 's/^PLUGINCHECK2_VERSION = //p' Makefile)"

title="Automatic chore(deps): bump Grafana plugin validator to ${version}"
body="Bumps plugincheck2 to ${version}, see https://github.com/grafana/plugin-validator/releases/tag/plugin-validator%2F${version}"

# A pull request closed without merging must not come back the next day, and
# the pushed branch alone is no proof of one: creating the PR may have failed.
proposed_pr="$(gh pr list --head "$branch" --state all --json number,title \
  --jq "map(select(.title | endswith(\" ${version}\"))) | .[0].number // empty")"
if [ -n "$proposed_pr" ]; then
  echo "plugincheck2 ${version} was already proposed in #${proposed_pr}, nothing to do"
  exit 0
fi

git checkout -b "$branch"
git commit -m "$title" -- Makefile
git push --force origin "$branch"

# An upgrade pull request left open is refreshed instead of duplicated.
open_pr="$(gh pr list --head "$branch" --state open --json number --jq '.[0].number // empty')"
if [ -n "$open_pr" ]; then
  gh pr edit "$open_pr" --title "$title" --body "$body"
else
  gh pr create --head "$branch" --title "$title" --body "$body"
fi

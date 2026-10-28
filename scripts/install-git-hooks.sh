#!/bin/sh
# Install reproducible project hooks without replacing a custom local setup.
set -eu
cd "$(dirname "$0")/.."

# npm install also runs prepare in non-Git deployment archives.
[ -e .git ] || exit 0
[ "${CI:-}" = "true" ] && exit 0

current="$(git config --local --get core.hooksPath || true)"
if [ -n "$current" ] && [ "$current" != ".githooks" ]; then
  printf '%s\n' "git hooks: preserving existing core.hooksPath=$current"
  exit 0
fi

chmod +x .githooks/pre-commit
git config --local core.hooksPath .githooks
printf '%s\n' "git hooks: .githooks/pre-commit installed"

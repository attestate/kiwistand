#!/usr/bin/env bash
# Runs on the server after a deploy's rsync (npm run deploy:install, and the
# deploy workflow): reinstalls node_modules with `npm ci`, but only when
# package-lock.json differs from the one last installed, whose hash is kept in
# .deployed-lock.sha256 (gitignored, server-only).
#
# Exits non-zero when npm ci fails, so the deploy fails and doesn't restart.
# In that case the previous node_modules is put back (npm ci deletes it before
# installing) and the hash isn't updated, so the next deploy tries again.
set -euo pipefail

cd "$(dirname "$0")/.."

if sha256sum -c --status .deployed-lock.sha256 2>/dev/null; then
  echo "package-lock.json unchanged since the last install, skipping npm ci"
  exit 0
fi

echo "package-lock.json changed (or no install recorded yet): running npm ci"

# Hard-link snapshot of the current tree: cheap, and survives npm ci's
# deleting node_modules, so a failed install can be rolled back.
rm -rf node_modules.prev
if [ -d node_modules ]; then
  cp -al node_modules node_modules.prev
fi

if ! npm ci; then
  echo "npm ci FAILED on the server" >&2
  if [ -d node_modules.prev ]; then
    echo "Restoring the previous node_modules" >&2
    rm -rf node_modules
    mv node_modules.prev node_modules
  fi
  exit 1
fi

sha256sum package-lock.json > .deployed-lock.sha256
rm -rf node_modules.prev
echo "npm ci done, recorded $(cut -c1-12 .deployed-lock.sha256)"

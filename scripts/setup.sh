#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

log() {
  echo "[setup] $1"
}

# Fetch pkg/lib exactly like CI does (the Makefile pins a cockpit commit),
# so local development and CI always build against the same shared library.
cd "${PROJECT_ROOT}"
if [ -L "${PROJECT_ROOT}/pkg" ]; then
  log "Removing legacy pkg symlink; the Makefile manages pkg/lib now"
  rm "${PROJECT_ROOT}/pkg"
fi
log "Fetching Cockpit shared assets (make pkg/lib)"
make pkg/lib
log "Installing npm dependencies via npm ci"
if npm ci; then
  log "npm ci completed successfully"
else
  log "npm ci failed; falling back to npm install && npm dedupe"
  npm install
  npm dedupe
fi

log "Building project assets"
npm run build
log "Setup complete"


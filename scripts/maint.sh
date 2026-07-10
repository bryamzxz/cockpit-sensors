#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)

log() {
  echo "[maint] $1"
}

# pkg/lib is pinned by the Makefile (COCKPIT_REPO_COMMIT) so local builds
# match CI; a stale symlink from older setups is removed.
cd "${PROJECT_ROOT}"
if [ -L "${PROJECT_ROOT}/pkg" ]; then
  log "Removing legacy pkg symlink; the Makefile manages pkg/lib now"
  rm "${PROJECT_ROOT}/pkg"
fi
log "Refreshing Cockpit shared assets (make pkg/lib)"
make pkg/lib
PACKAGE_LOCK_CHANGED=false
if git rev-parse HEAD@{1} >/dev/null 2>&1; then
  if ! git diff --quiet HEAD@{1} HEAD -- package-lock.json; then
    PACKAGE_LOCK_CHANGED=true
  fi
else
  if [ -f "${PROJECT_ROOT}/package-lock.json" ]; then
    PACKAGE_LOCK_CHANGED=true
  fi
fi

DEPENDENCIES_STALE=${PACKAGE_LOCK_CHANGED}
if [ ! -d "${PROJECT_ROOT}/node_modules" ]; then
  DEPENDENCIES_STALE=true
fi

if [ "${DEPENDENCIES_STALE}" = true ]; then
  log "Installing dependencies via npm ci"
  npm ci
else
  log "package-lock.json unchanged and node_modules present; running npm prune && npm rebuild"
  npm prune
  npm rebuild
fi

log "Building project assets"
npm run build

log "Build artefacts summary"
if [ -d "${PROJECT_ROOT}/dist" ]; then
  total_size=$(du -sh "${PROJECT_ROOT}/dist" | cut -f1)
  file_count=$(find "${PROJECT_ROOT}/dist" -type f | wc -l | tr -d ' ')
  log "dist/: ${total_size} across ${file_count} files"
  find "${PROJECT_ROOT}/dist" -maxdepth 1 -type f -printf '%f\n' | sort | while read -r file; do
    log " - ${file}"
  done
else
  log "dist/ directory not found"
fi

log "Maintenance complete"


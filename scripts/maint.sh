#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
COCKPIT_DIR=${COCKPIT_DIR:-"${PROJECT_ROOT}/../cockpit"}

log() {
  echo "[maint] $1"
}

if [ -d "${COCKPIT_DIR}/.git" ]; then
  log "Fetching updates in ${COCKPIT_DIR}" 
  git -C "${COCKPIT_DIR}" fetch --all --prune
else
  if [ -d "${COCKPIT_DIR}" ]; then
    log "Cockpit repository exists but is not a git checkout; skipping fetch"
  else
    log "Cockpit repository not found at ${COCKPIT_DIR}; skipping fetch"
  fi
fi

PKG_TARGET="${COCKPIT_DIR}/pkg"
PKG_LINK="${PROJECT_ROOT}/pkg"
log "Ensuring pkg symlink points to ${PKG_TARGET}"
if [ -e "${PKG_LINK}" ] && [ ! -L "${PKG_LINK}" ]; then
  rm -rf "${PKG_LINK}"
fi
ln -sfn "${PKG_TARGET}" "${PKG_LINK}"

cd "${PROJECT_ROOT}"
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


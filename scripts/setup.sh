#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROJECT_ROOT=$(cd "${SCRIPT_DIR}/.." && pwd)
COCKPIT_DIR=${COCKPIT_DIR:-"${PROJECT_ROOT}/../cockpit"}

log() {
  echo "[setup] $1"
}

log "Preparing Cockpit checkout at ${COCKPIT_DIR}". 
if [ -d "${COCKPIT_DIR}" ] && [ ! -d "${COCKPIT_DIR}/.git" ]; then
  log "Existing path at ${COCKPIT_DIR} is not a git checkout; replacing with fresh clone"
  rm -rf "${COCKPIT_DIR}"
fi

if [ ! -d "${COCKPIT_DIR}" ]; then
  log "Cloning cockpit repository (depth=1)"
  git clone --depth=1 https://github.com/cockpit-project/cockpit.git "${COCKPIT_DIR}"
else
  log "Existing cockpit repository detected; skipping clone"
fi

PKG_TARGET="${COCKPIT_DIR}/pkg"
PKG_LINK="${PROJECT_ROOT}/pkg"
log "Linking pkg directory from ${PKG_TARGET}".
if [ -e "${PKG_LINK}" ] && [ ! -L "${PKG_LINK}" ]; then
  rm -rf "${PKG_LINK}"
fi
ln -sfn "${PKG_TARGET}" "${PKG_LINK}"

cd "${PROJECT_ROOT}"
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


#!/bin/sh
# =============================================================================
# generate-manifest.sh
# Generates reports/manifest.json from .metadata files in each report folder.
# Can be run locally or from CI.
#
# Usage:
#   sh generate-manifest.sh [reports-dir]
#
# Default reports-dir: ./reports
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORTS_DIR="${1:-${SCRIPT_DIR}/reports}"
MANIFEST="${REPORTS_DIR}/manifest.json"

if [ ! -d "${REPORTS_DIR}" ]; then
  echo "ERROR: Reports directory not found: ${REPORTS_DIR}"
  exit 1
fi

echo "[manifest] Scanning ${REPORTS_DIR} for .metadata files..."

# Start JSON array
echo "[" > "${MANIFEST}.tmp"

FIRST=1
COUNT=0

# Iterate report folders sorted reverse (newest first)
for meta in $(find "${REPORTS_DIR}" -maxdepth 2 -name ".metadata" -type f 2>/dev/null | sort -r); do
  dir_path=$(dirname "${meta}")
  dir_name=$(basename "${dir_path}")

  # Read metadata values (strip \r for Windows-edited files)
  R_TS=$(grep '^TIMESTAMP=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_ENV=$(grep '^ENVIRONMENT=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_BRANCH=$(grep '^BRANCH=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_JOB_META=$(grep '^JOB=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_TOTAL=$(grep '^TOTAL=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_PASSED=$(grep '^PASSED=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_FAILED=$(grep '^FAILED=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_PIPE=$(grep '^PIPELINE_URL=' "${meta}" | cut -d= -f2- | tr -d '\r')
  R_JOBURL=$(grep '^JOB_URL=' "${meta}" | cut -d= -f2- | tr -d '\r')

  # Extract job from folder name (pattern: {timestamp}__{job}__{env}__{branch}__{status})
  # This is more reliable than .metadata JOB which may not match the folder
  R_JOB=$(echo "${dir_name}" | sed 's/^[0-9_-]*__//' | sed 's/__.*//')
  # Fallback to metadata JOB if extraction failed
  [ -z "${R_JOB}" ] && R_JOB="${R_JOB_META:-unknown}"

  # Defaults
  R_TS="${R_TS:-}"
  R_ENV="${R_ENV:-unknown}"
  R_BRANCH="${R_BRANCH:-unknown}"
  R_TOTAL="${R_TOTAL:-0}"
  R_PASSED="${R_PASSED:-0}"
  R_FAILED="${R_FAILED:-0}"

  # Add comma separator (not before first entry)
  if [ "${FIRST}" -eq 1 ]; then
    FIRST=0
  else
    echo "," >> "${MANIFEST}.tmp"
  fi

  # Write JSON entry (escaping backslashes then double-quotes for all string values)
  R_BRANCH_ESC=$(printf '%s' "${R_BRANCH}" | sed 's/\\/\\\\/g; s/"/\\"/g')
  R_PIPE_ESC=$(printf '%s' "${R_PIPE}" | sed 's/\\/\\\\/g; s/"/\\"/g')
  R_JOBURL_ESC=$(printf '%s' "${R_JOBURL}" | sed 's/\\/\\\\/g; s/"/\\"/g')

  cat >> "${MANIFEST}.tmp" << ENTRY
  {
    "folder": "${dir_name}",
    "timestamp": "${R_TS}",
    "environment": "${R_ENV}",
    "branch": "${R_BRANCH_ESC}",
    "job": "${R_JOB}",
    "total": ${R_TOTAL},
    "passed": ${R_PASSED},
    "failed": ${R_FAILED},
    "pipelineUrl": "${R_PIPE_ESC}",
    "jobUrl": "${R_JOBURL_ESC}"
  }
ENTRY

  COUNT=$((COUNT + 1))
done

echo "]" >> "${MANIFEST}.tmp"

# Atomically replace
mv "${MANIFEST}.tmp" "${MANIFEST}"

echo "[manifest] Generated ${MANIFEST} with ${COUNT} entries."

# ─── Update stats history (preserves data beyond report retention) ───
if command -v node >/dev/null 2>&1; then
  echo "[manifest] Updating stats history..."
  node "${SCRIPT_DIR}/update-stats-history.js" "${REPORTS_DIR}" || echo "[manifest] Warning: stats history update failed (non-blocking)"
else
  echo "[manifest] Skipping stats history update (node not available)"
fi

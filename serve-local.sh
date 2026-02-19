#!/bin/sh
# =============================================================================
# serve-local.sh
# Regenerate manifest + stats, then serve the Allure dashboard locally.
#
# Usage:
#   sh serve-local.sh [port]
#
# Default port: 8080
# =============================================================================

set -e

PORT="${1:-8080}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

cd "${SCRIPT_DIR}"

echo "======================================"
echo "  Allure Dashboard — Local Server"
echo "======================================"
echo ""

# Step 1: Regenerate manifest.json (also triggers stats update)
if [ -d "reports" ]; then
  echo "[1/2] Regenerating manifest.json + stats-history.json ..."
  sh generate-manifest.sh
  echo ""
else
  echo "[1/2] No reports/ directory found — skipping manifest generation."
  echo "       (Stats page will use existing stats-history.json if available)"
  echo ""
fi

# Step 2: Serve
echo "[2/2] Starting local server..."
echo ""
echo "  URL:  http://localhost:${PORT}"
echo "  Dir:  ${SCRIPT_DIR}"
echo ""
echo "  Pages:"
echo "    http://localhost:${PORT}/            — Reports dashboard"
echo "    http://localhost:${PORT}/stats.html  — Stats dashboard"
echo ""
echo "  Press Ctrl+C to stop"
echo "======================================"
echo ""

# Try python3 first, then python, then npx serve
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server "${PORT}"
elif command -v python >/dev/null 2>&1; then
  python -m SimpleHTTPServer "${PORT}" 2>/dev/null || python -m http.server "${PORT}"
elif command -v npx >/dev/null 2>&1; then
  npx serve -l "${PORT}" .
else
  echo "ERROR: No HTTP server found. Install Python 3 or Node.js."
  exit 1
fi

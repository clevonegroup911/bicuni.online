#!/usr/bin/env bash
set -u

echo "=== BICUNI QUALITY GATE ==="

FAILED=0

run_if_script() {
  local name="$1"
  if node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts['$name'] ? 0 : 1)" 2>/dev/null; then
    echo
    echo ">>> npm run $name"
    npm run "$name" || FAILED=1
  else
    echo "[SKIP] package.json has no script: $name"
  fi
}

if [ ! -f package.json ]; then
  echo "[WARN] package.json not found. Generic JS/TS quality gate skipped."
  exit 0
fi

# Dependency install is deliberately NOT automatic.
# The developer/CI environment should install dependencies explicitly.

run_if_script lint
run_if_script typecheck
run_if_script test
run_if_script build

echo
if [ "$FAILED" -eq 0 ]; then
  echo "=== RESULT: PASS ==="
  exit 0
else
  echo "=== RESULT: FAIL ==="
  exit 1
fi

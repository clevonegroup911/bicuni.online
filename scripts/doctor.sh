#!/usr/bin/env bash
set -u

echo "=== BICUNI DEV DOCTOR ==="

check() {
  if command -v "$1" >/dev/null 2>&1; then
    echo "[OK] $1: $(command -v "$1")"
  else
    echo "[WARN] $1 not found"
  fi
}

check git
check node
check npm
check pnpm
check yarn
check docker
check docker-compose
check gh

echo
echo "=== Repository ==="
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "[OK] git repository"
  echo "Branch: $(git branch --show-current)"
  echo "Changes:"
  git status --short
else
  echo "[WARN] Not inside a git repository"
fi

echo
echo "=== Project markers ==="
for f in package.json pnpm-lock.yaml yarn.lock package-lock.json docker-compose.yml compose.yml Dockerfile .env.example; do
  if [ -e "$f" ]; then
    echo "[OK] $f"
  fi
done

echo
echo "Doctor complete."

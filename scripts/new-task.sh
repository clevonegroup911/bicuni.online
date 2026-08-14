#!/usr/bin/env bash
set -euo pipefail

TITLE="${1:-}"
if [ -z "$TITLE" ]; then
  echo 'Usage: ./scripts/new-task.sh "Task title"'
  exit 1
fi

DATE="$(date +%Y%m%d)"
SLUG="$(printf '%s' "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')"
DIR="docs/tasks"
mkdir -p "$DIR"

N=1
while true; do
  ID=$(printf "BICUNI-%s-%03d" "$DATE" "$N")
  FILE="$DIR/${ID}-${SLUG}.md"
  [ ! -e "$FILE" ] && break
  N=$((N+1))
done

cat > "$FILE" <<EOF
# TASK — $TITLE

ID: $ID
Priority: P1
Status: PLANNED
Owner: Cursor
Reviewer: Codex

## Objective

<TODO>

## Business reason

<TODO>

## Current state

<TODO>

## Scope

- <TODO>

## Out of scope

- <TODO>

## Acceptance criteria

- [ ] <TODO>

## Security / permissions

- <TODO>

## Database impact

- <TODO>

## API impact

- <TODO>

## UI impact

- <TODO>

## Tests required

- [ ] Unit, if applicable
- [ ] Integration, if applicable
- [ ] E2E, if applicable
- [ ] Manual smoke test

## Completion evidence

- Files changed:
- Commands run:
- Results:
- Remaining risks:
EOF

echo "Created: $FILE"

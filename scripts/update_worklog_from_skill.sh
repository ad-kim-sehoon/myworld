#!/bin/sh
set -e

# Avoid running for worklog commits to prevent loop
MSG=$(git log -1 --pretty=%B)
FIRSTLINE=$(printf "%s" "$MSG" | sed -n '1p')
# Skip if the commit message already is a worklog commit
if [ "${FIRSTLINE#chore(worklog):}" != "$FIRSTLINE" ]; then
  exit 0
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "(unknown)")
HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "(unknown)")
DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Files changed in HEAD
CHANGED=$(git diff-tree --no-commit-id --name-only -r HEAD || true)

# Filter for skills/*/SKILL.md
SKILLS=$(printf "%s\n" "$CHANGED" | grep -E '^skills/.+/SKILL.md$' || true)

if [ -z "$SKILLS" ]; then
  # Nothing to do
  exit 0
fi

# Prepare docs dir
mkdir -p docs
TMPFILE=$(mktemp)

# Header for entry
printf "%s - SKILL.md 변경 (commit %s on %s)\n\n" "$DATE" "$HASH" "$BRANCH" > "$TMPFILE"
printf "커밋 메시지: %s\n\n" "$(echo "$MSG" | head -n1)" >> "$TMPFILE"
printf "변경된 SKILL.md:\n" >> "$TMPFILE"
printf "%s\n\n" "$(printf "%s" "$SKILLS" | sed 's/^/- /')" >> "$TMPFILE"
printf "관련 커밋: %s\n" "$HASH" >> "$TMPFILE"
printf "\n다음 작업:\n- (직접 업데이트)\n\n---\n\n" >> "$TMPFILE"

# Prepend to docs/WORKLOG.md so newest entries are on top
if [ -f docs/WORKLOG.md ]; then
  cat docs/WORKLOG.md >> "$TMPFILE"
fi
mv "$TMPFILE" docs/WORKLOG.md
chmod 644 docs/WORKLOG.md

# Commit the WORKLOG entry (skip hooks to avoid recursion)
git add docs/WORKLOG.md || true
# Use --no-verify to avoid re-running hooks (we still guard by commit message)
git commit -m "chore(worklog): record SKILL.md changes from $HASH" --no-verify || true

exit 0

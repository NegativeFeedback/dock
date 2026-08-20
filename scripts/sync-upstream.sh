#!/usr/bin/env bash
# Pulls the latest source from the upstream Dockhand repo (Finsys/dockhand)
# into the current branch of this fork.
#
# Usage: scripts/sync-upstream.sh [branch]
#   branch defaults to upstream's default branch (main)

set -euo pipefail

UPSTREAM_REMOTE="upstream"
UPSTREAM_URL="https://github.com/Finsys/dockhand"
BRANCH="${1:-main}"

if ! git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1; then
	echo "Adding missing '$UPSTREAM_REMOTE' remote ($UPSTREAM_URL)"
	git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
fi

echo "Fetching $UPSTREAM_REMOTE/$BRANCH..."
git fetch "$UPSTREAM_REMOTE" "$BRANCH"

echo
echo "New upstream commits since last sync:"
git log --oneline "HEAD..${UPSTREAM_REMOTE}/${BRANCH}" || true
echo

echo "Merging ${UPSTREAM_REMOTE}/${BRANCH} into $(git branch --show-current)..."
if git merge "${UPSTREAM_REMOTE}/${BRANCH}" --no-edit; then
	echo "Merge complete, no conflicts."
else
	cat <<EOF

Merge stopped with conflicts. src/lib/server/license.ts is the file most
likely to conflict, since it carries your self-issued LICENSE_PUBLIC_KEY —
if it conflicts, keep your key (this fork's version) and take upstream's
changes for everything else in the file.

Resolve conflicts, then:
  git add <resolved files>
  git commit
EOF
	exit 1
fi

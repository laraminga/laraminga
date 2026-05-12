#!/usr/bin/env bash
# La Raminga — deploy
# Builds the static site (node build.mjs) and pushes the contents of dist/
# to the gh-pages branch on the remote, as a single fresh commit on top
# of the current gh-pages tip. Source files on other branches are not
# touched. Run from the project root.
#
# Optional env: DEPLOY_REMOTE (default: origin)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

DIST="$ROOT/dist"
BRANCH="gh-pages"
REMOTE="${DEPLOY_REMOTE:-origin}"

# ─── safety ────────────────────────────────────────────────────────────────
CURRENT="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
if [ "$CURRENT" = "$BRANCH" ]; then
  cat >&2 <<EOF
✗ refusing to deploy while on the '$BRANCH' branch.
  Switch to a source branch (e.g. main) before running this script,
  otherwise the deploy would overwrite the source files on the remote.
EOF
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "✗ node not found in PATH" >&2
  exit 1
fi

if ! REMOTE_URL="$(git remote get-url "$REMOTE" 2>/dev/null)"; then
  echo "✗ no remote named '$REMOTE'. set DEPLOY_REMOTE or configure it first." >&2
  exit 1
fi

# ─── 1. build ──────────────────────────────────────────────────────────────
echo "▶ build"
node build.mjs

if [ ! -d "$DIST" ] || [ -z "$(ls -A "$DIST" 2>/dev/null)" ]; then
  echo "✗ dist/ is missing or empty after build" >&2
  exit 1
fi

# ─── 2. prepare a clean worktree off remote gh-pages ───────────────────────
TMP="$(mktemp -d -t la-raminga-deploy.XXXXXXXX)"
trap 'rm -rf "$TMP"' EXIT

cd "$TMP"
git init -q
git remote add "$REMOTE" "$REMOTE_URL"

if git ls-remote --exit-code --heads "$REMOTE" "$BRANCH" >/dev/null 2>&1; then
  echo "▶ fetching $REMOTE/$BRANCH"
  git fetch -q --depth 1 "$REMOTE" "$BRANCH"
  git checkout -q -b "$BRANCH" FETCH_HEAD
else
  echo "▶ creating $REMOTE/$BRANCH (orphan)"
  git checkout -q --orphan "$BRANCH"
fi

# ─── 3. replace working tree with the freshly built dist ───────────────────
find . -mindepth 1 -maxdepth 1 ! -name '.git' -exec rm -rf {} +
cp -R "$DIST/." ./

# ─── 4. commit & push (only if anything changed) ───────────────────────────
git add -A
if git diff --cached --quiet; then
  echo "▶ no changes to deploy"
  exit 0
fi

STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
GIT_NAME="${GIT_AUTHOR_NAME:-deploy}"
GIT_MAIL="${GIT_AUTHOR_EMAIL:-deploy@laraminga.com}"

git -c user.name="$GIT_NAME" -c user.email="$GIT_MAIL" \
    commit -q -m "deploy $STAMP"

echo "▶ pushing $REMOTE/$BRANCH"
git push -q "$REMOTE" "$BRANCH"
echo "✓ deployed $STAMP" 
#!/usr/bin/env bash
# scripts/release.sh — whitelist-based release builder for Dag Book Crafter
# Per PKG-07 / D-26 / D-27. Phase 11 — no git tagging (Phase 12 GATE-09 owns that).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# --- Gate 1: version from plugin.json ---
VERSION=$(grep '"version"' .claude-plugin/plugin.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
if [ -z "$VERSION" ]; then
  echo "FAIL (Gate 1): could not parse version from .claude-plugin/plugin.json" >&2
  exit 1
fi
echo "Gate 1 OK: version = $VERSION"

# --- Gate 2: CHANGELOG has ## [VERSION] ---
if ! grep -qE "^## \[${VERSION}\]" CHANGELOG.md; then
  echo "FAIL (Gate 2): CHANGELOG.md missing ## [${VERSION}] entry" >&2
  exit 1
fi
echo "Gate 2 OK: CHANGELOG has [${VERSION}]"

# --- Gate 3: whitelist copy into staging ---
TMPROOT=$(mktemp -d -t dag-book-crafter-release.XXXXXX)
STAGING="$TMPROOT/dag-book-crafter"
trap 'rm -rf "$TMPROOT"' EXIT
mkdir -p "$STAGING"

# Directories
cp -R .claude-plugin "$STAGING/"
cp -R skills "$STAGING/"
cp -R agents "$STAGING/"
cp -R references "$STAGING/"

# scripts/ — whitelisted files only, NOT the whole directory
mkdir -p "$STAGING/scripts"
cp scripts/craft-check.js "$STAGING/scripts/"
cp scripts/test-craft-check.js "$STAGING/scripts/"
cp scripts/test-rubric-regression.js "$STAGING/scripts/"

# fixtures/tiny-book/ — whitelisted files only
mkdir -p "$STAGING/fixtures/tiny-book"
cp fixtures/tiny-book/brief.md "$STAGING/fixtures/tiny-book/"
cp fixtures/tiny-book/expected-captivation-score.txt "$STAGING/fixtures/tiny-book/"

# --- Adversarial fixture exclusion (Phase 13 D-22 / D-18) ---
# fixtures/tiny-book/adversarial/ and adversarial-enricher/ are test-only
# hand-authored known-bad manuscripts used by test-craft-check.js to prove
# the FAIL path. They MUST NEVER ship in the release zip. The explicit
# whitelist above already excludes them by omission; this assertion guards
# against a future widening of the copy logic.
if [ -d "$STAGING/fixtures/tiny-book/adversarial" ] || [ -d "$STAGING/fixtures/tiny-book/adversarial-enricher" ]; then
  echo "FAIL (Gate 3b): adversarial fixture leaked into staging" >&2
  exit 1
fi
echo "Gate 3b OK: adversarial fixtures excluded"

# Top-level docs
cp README.md "$STAGING/"
cp LICENSE "$STAGING/"
cp CHANGELOG.md "$STAGING/"

# Strip macOS .DS_Store stowaways that ride along with cp -R
find "$STAGING" -name '.DS_Store' -type f -delete
echo "Gate 3 OK: whitelist copied to $STAGING"

# --- Gate 4: dev→release name rewrite (staging only) ---
sed -i.bak 's/"name": "dag-book-crafter-dev"/"name": "dag-book-crafter"/' "$STAGING/.claude-plugin/plugin.json"
rm -f "$STAGING/.claude-plugin/plugin.json.bak"
grep -q '"name": "dag-book-crafter"' "$STAGING/.claude-plugin/plugin.json" || {
  echo "FAIL (Gate 4): staging plugin.json name rewrite failed" >&2; exit 1;
}
grep -q '"name": "dag-book-crafter-dev"' .claude-plugin/plugin.json || {
  echo "FAIL (Gate 4): repo plugin.json was accidentally mutated" >&2; exit 1;
}
echo "Gate 4 OK: staging=dag-book-crafter, repo=dag-book-crafter-dev"

# --- Gate 5: claude plugin validate (guarded) ---
if command -v claude >/dev/null 2>&1; then
  if ! claude plugin validate "$STAGING"; then
    echo "FAIL (Gate 5): claude plugin validate rejected staging" >&2
    exit 1
  fi
  echo "Gate 5 OK: claude plugin validate passed"
else
  echo "WARN (Gate 5): claude CLI not on PATH, skipping validate"
fi

# --- Gate 6: zip ---
mkdir -p dist
ZIPPATH="$ROOT/dist/dag-book-crafter-v${VERSION}.zip"
rm -f "$ZIPPATH"
(cd "$TMPROOT" && zip -rX "$ZIPPATH" dag-book-crafter >/dev/null)
echo "Gate 6 OK: $ZIPPATH"

# --- Gate 7: size check ---
if [[ "$OSTYPE" == "darwin"* ]]; then
  SIZE=$(stat -f%z "$ZIPPATH")
else
  SIZE=$(stat -c%s "$ZIPPATH")
fi
MAX=$((5 * 1024 * 1024))
if [ "$SIZE" -gt "$MAX" ]; then
  echo "FAIL (Gate 7): zip size ${SIZE} > 5MB (${MAX})" >&2
  exit 1
fi
echo "Gate 7 OK: size ${SIZE} bytes (<= 5MB)"

# --- Gate 8: personal-path grep ---
set +e
unzip -p "$ZIPPATH" | grep -c '/Users/David' >/tmp/release-grep-count.$$
HITS=$(cat /tmp/release-grep-count.$$)
rm -f /tmp/release-grep-count.$$
set -e
if [ "${HITS:-0}" -gt 0 ]; then
  echo "FAIL (Gate 8): zip contains ${HITS} /Users/David references" >&2
  exit 1
fi
echo "Gate 8 OK: no /Users/David references in zip"

# --- Gate 9: print manifest ---
echo ""
echo "=== Manifest ==="
unzip -l "$ZIPPATH"
echo ""
echo "SUCCESS: $ZIPPATH built (${SIZE} bytes, version ${VERSION})"

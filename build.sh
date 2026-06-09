#!/usr/bin/env bash
# build.sh — package plugin, update index.yml, prune old releases, commit & push.
# Run from the repo root after bumping the version in performer-refresh/performer-refresh.yml.
set -euo pipefail

PLUGIN_DIR="performer-refresh"
RELEASES_DIR="releases"
INDEX="index.yml"
MAX_KEEP=5

# ── Read version from plugin manifest ──────────────────────────────────────
VERSION=$(grep '^version:' "${PLUGIN_DIR}/performer-refresh.yml" \
          | sed 's/^version:[[:space:]]*//' | tr -d '"')

if [[ -z "$VERSION" ]]; then
  echo "Error: could not read version from ${PLUGIN_DIR}/performer-refresh.yml" >&2
  exit 1
fi

ZIP_NAME="performer-refresh-${VERSION}.zip"
ZIP_PATH="${RELEASES_DIR}/${ZIP_NAME}"

echo "Building performer-refresh v${VERSION}..."

# ── Create zip (files at root, no subdirectory) ─────────────────────────────
mkdir -p "$RELEASES_DIR"
(cd "$PLUGIN_DIR" && zip -j "../${ZIP_PATH}" \
  performer-refresh.yml performer-refresh.js performer-refresh.css)

# ── Compute SHA256 ──────────────────────────────────────────────────────────
SHA256=$(sha256sum "${ZIP_PATH}" | cut -d' ' -f1)
DATE=$(date -u '+%Y-%m-%d %H:%M:%S')

echo "  zip:    ${ZIP_PATH}"
echo "  sha256: ${SHA256}"
echo "  date:   ${DATE}"

# ── Update index.yml ─────────────────────────────────────────────────────────
python3 << PYEOF
import re

with open('${INDEX}', 'r') as f:
    text = f.read()

text = re.sub(r'(?m)^  version: ".*?"',     '  version: "${VERSION}"', text)
text = re.sub(r'(?m)^  date: ".*?"',        '  date: "${DATE}"', text)
text = re.sub(r'(?m)^  path: \S+',          '  path: ${RELEASES_DIR}/${ZIP_NAME}', text)
text = re.sub(r'(?m)^  sha256: [a-f0-9]+',  '  sha256: ${SHA256}', text)

with open('${INDEX}', 'w') as f:
    f.write(text)

print('  index.yml updated')
PYEOF

# ── Prune old releases — keep the ${MAX_KEEP} most recent by semver ──────────
# sort -V sorts by version number; head -n -N drops the N newest, leaving the old ones
OLD_ZIPS=$(ls "${RELEASES_DIR}"/performer-refresh-*.zip 2>/dev/null \
           | sort -V \
           | head -n "-${MAX_KEEP}" \
           || true)

if [[ -n "$OLD_ZIPS" ]]; then
  while IFS= read -r OLD; do
    [[ -z "$OLD" ]] && continue
    echo "  pruning: $OLD"
    if git ls-files --error-unmatch "$OLD" &>/dev/null 2>&1; then
      git rm --force --quiet "$OLD"
    else
      rm -f "$OLD"
    fi
  done <<< "$OLD_ZIPS"
fi

# ── Stage changes ─────────────────────────────────────────────────────────────
git add \
  "${PLUGIN_DIR}/performer-refresh.yml" \
  "${PLUGIN_DIR}/performer-refresh.js" \
  "${PLUGIN_DIR}/performer-refresh.css" \
  "${ZIP_PATH}" \
  "${INDEX}"

# ── Commit ────────────────────────────────────────────────────────────────────
git commit -m "Release performer-refresh v${VERSION}

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# ── Push ──────────────────────────────────────────────────────────────────────
if git remote get-url origin &>/dev/null; then
  git push
else
  echo ""
  echo "Note: no remote 'origin' configured — commit created locally, push manually."
fi

echo ""
echo "Done: performer-refresh v${VERSION}"

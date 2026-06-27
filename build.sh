#!/usr/bin/env bash
# build.sh — package every plugin under plugins/ whose version increased,
# update index.yml, prune old releases per plugin, commit & push.
# Run from the repo root after bumping a plugin's version in plugins/<id>/<id>.yml.
set -euo pipefail
shopt -s nullglob

PLUGINS_DIR="plugins"
RELEASES_DIR="releases"
INDEX="index.yml"
MAX_KEEP=5
REPO_ROOT="$(pwd)"

mkdir -p "$RELEASES_DIR"

BUILT=()

for PLUGIN_PATH in "${PLUGINS_DIR}"/*/; do
  PLUGIN_ID="$(basename "$PLUGIN_PATH")"
  MANIFEST="${PLUGIN_PATH}${PLUGIN_ID}.yml"

  if [[ ! -f "$MANIFEST" ]]; then
    echo "Warning: no ${MANIFEST}, skipping ${PLUGIN_ID}" >&2
    continue
  fi

  VERSION=$(grep '^version:' "$MANIFEST" | head -1 | sed 's/^version:[[:space:]]*//' | tr -d '"')
  if [[ -z "$VERSION" ]]; then
    echo "Warning: could not read version from ${MANIFEST}, skipping ${PLUGIN_ID}" >&2
    continue
  fi

  # ── Current version recorded in index.yml for this plugin ─────────────────
  INDEXED_VERSION=$(awk -v id="$PLUGIN_ID" '
    $0 == "- id: " id { inentry=1; next }
    /^- id: / { inentry=0 }
    inentry && /^  version:/ { gsub(/^  version: *"|"$/, ""); print; exit }
  ' "$INDEX")

  if [[ "$VERSION" == "$INDEXED_VERSION" ]]; then
    echo "Skipping ${PLUGIN_ID} (v${VERSION} already released)"
    continue
  fi

  echo "Building ${PLUGIN_ID} v${VERSION}..."

  ZIP_NAME="${PLUGIN_ID}-${VERSION}.zip"
  ZIP_PATH="${RELEASES_DIR}/${ZIP_NAME}"
  ZIP_ABS="${REPO_ROOT}/${ZIP_PATH}"

  # ── Create zip (files at root, no subdirectory) ──────────────────────────
  (cd "$PLUGIN_PATH" && zip -j "$ZIP_ABS" *.yml *.js *.css)

  # ── Compute SHA256 ─────────────────────────────────────────────────────────
  SHA256=$(sha256sum "${ZIP_PATH}" | cut -d' ' -f1)
  DATE=$(date -u '+%Y-%m-%d %H:%M:%S')

  echo "  zip:    ${ZIP_PATH}"
  echo "  sha256: ${SHA256}"
  echo "  date:   ${DATE}"

  # ── Update this plugin's entry in index.yml ──────────────────────────────
  PLUGIN_ID="$PLUGIN_ID" VERSION="$VERSION" DATE="$DATE" ZIP_PATH="$ZIP_PATH" SHA256="$SHA256" INDEX="$INDEX" python3 << 'PYEOF'
import os, re, sys

plugin_id = os.environ['PLUGIN_ID']
version = os.environ['VERSION']
date = os.environ['DATE']
path = os.environ['ZIP_PATH']
sha256 = os.environ['SHA256']
index_path = os.environ['INDEX']

with open(index_path) as f:
    text = f.read()

parts = re.split(r'(?=^- id: )', text, flags=re.M)
header, entries = parts[0], parts[1:]

found = False
for i, entry in enumerate(entries):
    if entry.startswith(f"- id: {plugin_id}\n"):
        entry = re.sub(r'(?m)^  version: ".*?"', f'  version: "{version}"', entry)
        entry = re.sub(r'(?m)^  date: ".*?"', f'  date: "{date}"', entry)
        entry = re.sub(r'(?m)^  path: \S+', f'  path: {path}', entry)
        entry = re.sub(r'(?m)^  sha256: \S+', f'  sha256: {sha256}', entry)
        entries[i] = entry
        found = True
        break

if not found:
    sys.exit(f"Error: no index.yml entry for plugin '{plugin_id}' — add one manually first, then re-run.")

with open(index_path, 'w') as f:
    f.write(header + ''.join(entries))
PYEOF

  echo "  index.yml updated"

  git add "${ZIP_PATH}" "${INDEX}" "${PLUGIN_PATH}"*.yml "${PLUGIN_PATH}"*.js "${PLUGIN_PATH}"*.css

  # ── Prune old releases for this plugin — keep the ${MAX_KEEP} most recent ──
  OLD_ZIPS=$(ls "${RELEASES_DIR}/${PLUGIN_ID}"-*.zip 2>/dev/null \
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

  BUILT+=("${PLUGIN_ID} v${VERSION}")
done

if [[ ${#BUILT[@]} -eq 0 ]]; then
  echo ""
  echo "Nothing to release — all plugin versions already match index.yml."
  exit 0
fi

# ── Commit ────────────────────────────────────────────────────────────────────
SUMMARY=$(printf '%s, ' "${BUILT[@]}")
SUMMARY=${SUMMARY%, }
git commit -m "Release ${SUMMARY}"

# ── Push ──────────────────────────────────────────────────────────────────────
if git remote get-url origin &>/dev/null; then
  git push
else
  echo ""
  echo "Note: no remote 'origin' configured — commit created locally, push manually."
fi

echo ""
echo "Done: ${SUMMARY}"

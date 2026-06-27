# Stash Plugin Repo — Claude Instructions

This repo hosts multiple Stash plugins, each in its own folder under `plugins/`.

## After every completed change request

### 1. Bump the version

Update `version:` in the changed plugin's manifest (`plugins/<id>/<id>.yml`) using semver:

| Change type | Example |
|---|---|
| Bug fix | `0.1.8` → `0.1.9` |
| New feature | `0.1.8` → `0.2.0` |
| Breaking change | `0.1.8` → `1.0.0` |

### 2. Run the build script

```bash
./build.sh
```

This will, for every plugin under `plugins/` whose manifest version no longer matches the version recorded in `index.yml`:
- Create `releases/<plugin-id>-<version>.zip` from that plugin's source files
- Recompute the SHA256 and update that plugin's entry in `index.yml` (version, date, path, sha256)
- Remove releases older than the 5 most recent versions for that plugin, from both disk and git
- Commit all changes (one commit covering every plugin released in that run) and push to GitHub

Plugins whose version is unchanged are left untouched.

## Project layout

```
plugins/                         ← plugin sources (edit these)
  <plugin-id>/
    <plugin-id>.yml               ← Stash plugin manifest + version number
    <plugin-id>.js
    <plugin-id>.css                ← optional
    README.md                      ← optional, plugin-specific details
releases/                        ← distribution zips (managed by build.sh)
index.yml                        ← Stash plugin source index (updated by build.sh)
build.sh                         ← release script
README.md                        ← repo overview + per-plugin docs
```

## Notes

- The version in each plugin's `<id>.yml` is the single source of truth — `build.sh` reads it from there.
- Do **not** manually edit `index.yml`'s version/date/path/sha256 fields; `build.sh` owns those.
- A brand-new plugin needs a manually-added `index.yml` entry (id, name, requires, metadata) before `build.sh` can package it — it will error out otherwise rather than guessing metadata. Use `version: "0.0.0"` as a placeholder so the first real build is picked up as a version increase.
- The `releases/` folder keeps only the 5 most recent zips per plugin; older ones are removed from git history on the next build.
- Commits made by `build.sh` (or by Claude on this repo) must not include a `Co-Authored-By: Claude` trailer.

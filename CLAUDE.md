# Performer Refresh — Claude Instructions

## After every completed change request

### 1. Bump the version

Update `version:` in [performer-refresh/performer-refresh.yml](performer-refresh/performer-refresh.yml) using semver:

| Change type | Example |
|---|---|
| Bug fix | `0.1.8` → `0.1.9` |
| New feature | `0.1.8` → `0.2.0` |
| Breaking change | `0.1.8` → `1.0.0` |

### 2. Run the build script

```bash
./build.sh
```

This will:
- Create `releases/performer-refresh-<version>.zip` from the plugin source files
- Recompute the SHA256 and update `index.yml` (version, date, path, sha256)
- Remove releases older than the 5 most recent versions from both disk and git
- Commit all changes and push to GitHub

## Project layout

```
performer-refresh/          ← plugin source (edit these)
  performer-refresh.yml     ← Stash plugin manifest + version number
  performer-refresh.js
  performer-refresh.css
releases/                   ← distribution zips (managed by build.sh)
index.yml                   ← Stash plugin source index (updated by build.sh)
build.sh                    ← release script
```

## Notes

- The version in `performer-refresh/performer-refresh.yml` is the single source of truth — `build.sh` reads it from there.
- Do **not** manually edit `index.yml` version/date/path/sha256 fields; `build.sh` owns those.
- The `releases/` folder keeps only the 5 most recent zips; older ones are removed from git history on the next build.

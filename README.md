# Stash Plugin Repo

A collection of plugins for [Stash](https://github.com/stashapp/stash), distributed from a single plugin source.

## Adding this source to Stash

1. In Stash, go to **Settings → Plugins**
2. Under **Available Plugins**, click **Add Source**
3. Enter this URL:
   ```
   https://raw.githubusercontent.com/AnonTester/stash-plugin-repo/main/index.yml
   ```
4. Find a plugin in the list below and click **Install**
5. Reload the page

Updates are applied the same way: return to **Settings → Plugins**, check for updates, and install.

## Plugins

| Plugin | Description |
|---|---|
| [Performer Refresh](#performer-refresh) | Adds a refresh button next to the stash-box ID on performer pages, replicating the Update Performer modal from the Performer Tagger. |
| [Performer Disambiguation Search](#performer-disambiguation-search) | Makes performer search/autocomplete also match the Disambiguation field, not just name and aliases. |
| [Scene URL Enhancements](#scene-url-enhancements) | Adds an open-in-new-tab button to scene URLs, fixes their field width, and can relocate them to the Details tab. |

---

## Performer Refresh

A plugin that adds a refresh button next to the stash-box ID on performer pages, replicating the **Update Performer** modal from the Performer Tagger interface.

### Features

- Adds a ↻ refresh button next to the stash-box ID copy icon on performer pages
- Opens the **Update Performer** modal (identical layout to the Performer Tagger) with:
  - Field-by-field selection — check or uncheck each field individually
  - Image carousel to browse and select from all available performer images on the endpoint
  - Save and Cancel actions

### Requirements

- Stash v0.31.0 or later

### Installation

**Via Plugin Source (recommended):** install from the table above once this repo is added as a source.

**Manual:**

1. Download the latest `performer-refresh-*.zip` from [`releases/`](releases/)
2. Extract the zip into your Stash plugins directory so the files land at:
   ```
   <plugins-dir>/performer-refresh/performer-refresh.yml
   <plugins-dir>/performer-refresh/performer-refresh.js
   <plugins-dir>/performer-refresh/performer-refresh.css
   ```
3. Restart Stash or reload plugins

### Usage

Navigate to any performer page that has a stash-box ID linked. A ↻ icon appears next to the copy button for each stash-box ID. Click it to open the **Update Performer** modal.

---

## Performer Disambiguation Search

Extends every performer search/autocomplete in the Stash UI to also match the **Disambiguation** field, not just name and aliases. Covers the Performers page search box and the performer picker used on scenes, galleries, images, groups, markers, and the "Performers" filter criterion picker.

### Settings

- **Minimum search length (characters)** — search terms shorter than this are left as a plain name search (default: 2 if unset/0).

### Installation

**Via Plugin Source (recommended):** install from the table above once this repo is added as a source.

**Manual:**

1. Download the latest `performerDisambiguationSearch-*.zip` from [`releases/`](releases/)
2. Extract the zip into your Stash plugins directory so the files land at:
   ```
   <plugins-dir>/performerDisambiguationSearch/performerDisambiguationSearch.yml
   <plugins-dir>/performerDisambiguationSearch/performerDisambiguationSearch.js
   ```
3. Restart Stash or reload plugins

See [`plugins/performerDisambiguationSearch/README.md`](plugins/performerDisambiguationSearch/README.md) for how it works and known limitations.

---

## Scene URL Enhancements

Three small fixes for the URLs field on a scene's Edit tab:

1. **Open button** — adds an "Open URL in new tab" button to the left of the existing Scrape button on every URL row.
2. **Width fix** — corrects the URLs field, which otherwise renders full-width instead of matching the other fields (Title, Studio Code, Date, Director, ...).
3. **Details tab relocation** (setting, on by default) — moves the "URLs:" row from the File Info tab to the Details tab, under Tags.

### Settings

- **Show URLs on Details tab (instead of File Info)** — boolean, defaults to off until saved.

### Installation

**Via Plugin Source (recommended):** install from the table above once this repo is added as a source.

**Manual:**

1. Download the latest `sceneUrlEnhancements-*.zip` from [`releases/`](releases/)
2. Extract the zip into your Stash plugins directory so the files land at:
   ```
   <plugins-dir>/sceneUrlEnhancements/sceneUrlEnhancements.yml
   <plugins-dir>/sceneUrlEnhancements/sceneUrlEnhancements.js
   <plugins-dir>/sceneUrlEnhancements/sceneUrlEnhancements.css
   ```
3. Restart Stash or reload plugins

See [`plugins/sceneUrlEnhancements/README.md`](plugins/sceneUrlEnhancements/README.md) for how it works and known limitations.

---

## Author

[AnonTester](https://github.com/AnonTester/)

# Performer Refresh

A [Stash](https://github.com/stashapp/stash) plugin that adds a refresh button next to the stash-box ID on performer pages, replicating the **Update Performer** modal from the Performer Tagger interface.

## Features

- Adds a ↻ refresh button next to the stash-box ID copy icon on performer pages
- Opens the **Update Performer** modal (identical layout to the Performer Tagger) with:
  - Field-by-field selection — check or uncheck each field individually
  - Image carousel to browse and select from all available performer images on the endpoint
  - Save and Cancel actions

## Requirements

- Stash v0.31.0 or later

## Installation

### Via Plugin Source (recommended)

1. In Stash, go to **Settings → Plugins**
2. Under **Available Plugins**, click **Add Source**
3. Enter this URL:
   ```
   https://raw.githubusercontent.com/AnonTester/stash-performer-refresh/main/index.yml
   ```
4. Find **Performer Refresh** in the list and click **Install**
5. Reload the page

Updates are applied the same way: return to **Settings → Plugins**, check for updates, and install.

### Manual

1. Download the latest `performer-refresh-*.zip` from the [`performer-refresh/`](performer-refresh/) directory
2. Extract the zip into your Stash plugins directory so the files land at:
   ```
   <plugins-dir>/performer-refresh/performer-refresh.yml
   <plugins-dir>/performer-refresh/performer-refresh.js
   <plugins-dir>/performer-refresh/performer-refresh.css
   ```
3. Restart Stash or reload plugins

## Usage

Navigate to any performer page that has a stash-box ID linked. A ↻ icon appears next to the copy button for each stash-box ID. Click it to open the **Update Performer** modal.

## Author

[AnonTester](https://github.com/AnonTester/)

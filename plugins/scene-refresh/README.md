# Scene Refresh

Adds a refresh button next to every stash-box ID shown on a scene's **File Info** tab and **Edit** tab. It scrapes, or re-scrapes, exactly that stash-box scene from its own endpoint and lets you choose field by field what to update.

## Usage

1. Open a scene that has a stash-box ID. Next to each ID (for example `JAVStash 2001a6dd-...`) there is a ↻ button.
2. Click it. The plugin asks that stash-box for the scene with that exact ID and opens a dialog listing the scraped fields: Title, Studio Code, Date, Director, Details, URLs, Studio, Performers, Tags and Cover image.
3. Fields whose value differs from the scene are ticked; unchanged fields are dimmed and unticked. Adjust the ticks and click **Update scene**.

## Behaviour notes

- **URLs, Performers and Tags are added to the existing ones**, nothing is removed.
- **Studio, Performers and Tags are only matched to items already in your library** (the same matching Stash's scene tagger does). Anything not in the library is listed as skipped; it is not created.
- Updating saves straight to the scene and **reloads the page**. If the Edit form is open the dialog warns about this: unsaved changes in the form are lost.
- The stash-box ID itself is never changed.

## Requirements

- Stash v0.31.0 or later, with the stash-box configured under Settings → Metadata Providers.

## Installation

Install from the plugin source (see the repository README), or copy `scene-refresh.yml`, `scene-refresh.js` and `scene-refresh.css` into `<plugins-dir>/scene-refresh/`, then reload plugins and the page.

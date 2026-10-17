# Scene Refresh

Adds a refresh button next to every stash-box ID shown on a scene's **File Info** tab and **Edit** tab. It scrapes, or re-scrapes, exactly that stash-box scene using Stash's own scrape dialog.

## Usage

1. Open a scene that has a stash-box ID. Next to each ID (for example `JAVStash 2001a6dd-...`) there is a ↻ button.
2. Click it. The plugin switches to the **Edit** tab if needed and runs the same flow you would by hand: the magnifier button next to *Scrape with…*, the stash-box that owns the ID, a search for that ID, and a click on the single result.
3. Stash's own **Scene Scrape Results** dialog opens. Review it, click **Apply**, then **Save** on the Edit form.

## Behaviour notes

- Nothing is saved until you click **Save** in the Edit form, exactly as with a normal scrape. Changes already made in the form are kept.
- The search uses the stash-box ID itself, so only that scene is returned. If more than one result ever comes back, Stash's result list stays open for you to choose.
- If the stash-box has no scene for the ID, an error toast is shown.
- Because it is Stash's own dialog, field handling (tags, performers, studio matching, cover image) is exactly what Stash does for any scrape.

## Requirements

- Stash v0.31.0 or later, with the stash-box configured under Settings → Metadata Providers.

## Installation

Install from the plugin source (see the repository README), or copy `scene-refresh.yml`, `scene-refresh.js` and `scene-refresh.css` into `<plugins-dir>/scene-refresh/`, then reload plugins and the page.

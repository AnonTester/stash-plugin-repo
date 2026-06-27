# Scene URL Enhancements

Three small fixes for the URLs field on a scene's Edit tab:

1. **Open button** - adds an "Open URL in new tab" button (external-link icon)
   to the left of the existing Scrape button on every URL row. Disabled when
   the row is empty.
2. **Width fix** - the URLs field renders at `col-lg-12` (full row) while
   every other field (Title, Studio Code, Date, Director, ...) renders at
   `col-sm-3`/`col-sm-9`. Bootstrap's percentages for these two don't map to
   a fixed pixel ratio (row gutter/negative-margin math differs), and Stash's
   own sidebar switches between a narrow fixed-width column and a much wider
   mobile-style layout at several different pixel thresholds - so a static
   CSS rule can't track it. Instead, `fixUrlsWidth()`:
   - Detects whether Title's label and input are currently on the same line
     or stacked (compares their `top` position) and forces URLs' own row
     into the same mode via `flex-wrap`. This is a deliberate binary switch
     rather than relying on "does label+content width fit the row" - that
     emergent approach is rounding-sensitive and flips the wrong way right
     at Title's own wrap boundary (off-by-a-fraction-of-a-pixel vs Title's
     true sub-pixel layout).
   - Within that mode, matches Title's actual rendered label/input pixel
     widths so the sizes line up too.
   - Keeps clear of Stash's sidebar/video divider handle, which overlaps the
     last ~19px of any field that reaches the sidebar's right edge (true for
     Title too, just invisible there since it's not a button).
   Re-evaluated on every resize and DOM mutation.
3. **Details tab relocation** (setting, on by default) - hides the "URLs:"
   row on the File Info tab and shows it instead on the Details tab, directly
   under Tags. Reasoning: scene URLs aren't a property of the underlying
   file, so File Info isn't the right place for them.

## How it works

All three are plain DOM manipulation (no React patch API used) driven by a
`MutationObserver` on `document.body`, the same technique already used by
this instance's own `custom.js`. Stash renders all scene tab panels at once
and just toggles `display:none`, so the File Info content is always present
in the DOM to read from/clone, even while viewing another tab.

- The open button is inserted into `.input-group-append` next to the
  `.scrape-url-button`, idempotently (checked by class name before
  inserting), so it survives re-renders.
- The Details-tab URLs block is a **clone** of the File Info `<dd>` content
  (the original is hidden via `display:none`, not removed/moved), which
  avoids fighting React's reconciliation over node ownership. It's
  re-synced (removed + re-cloned) only when the source content actually
  changes (tracked via a `data-source-html` marker), so it doesn't do
  wasteful work on every unrelated DOM mutation (e.g. video player ticks).
- If the scene has no Tags heading to anchor on, the block falls back to the
  end of the Details tab's content area.

## Settings

- **Show URLs on Details tab (instead of File Info)** - BOOLEAN, defaults to
  off until saved; this instance has it explicitly saved to `true`.

## Known limitation

Multiple scenes were spot-checked (with/without tags, performers, and
descriptions) but this relies on Stash's current Details/File Info tab DOM
structure (`.scene-details`, `.file-info-panel`, `h6` text "Tag"/"Tags").
A future Stash UI rework could change this structure and require updating
the selectors in `sceneUrlEnhancements.js`.

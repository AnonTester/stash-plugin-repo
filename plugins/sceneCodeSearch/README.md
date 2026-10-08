# Scene Code Search

Extends every scene search/autocomplete in the Stash UI to also match the
scene's **Studio Code**. Stash's plain search box only looks at title, details,
path and similar fields, so searching for e.g. `JUX-441` won't find a scene
whose only link to that text is its Studio Code.

Covers:
- The search box on the Scenes page.
- The scene picker used on groups, markers and filter criteria - they share
  the `FindScenesForSelect` query.

## How it works

The plain search sends a `filter.q` term, and Stash has no way to OR a `q`
with a `scene_filter` such as `code INCLUDES ...`. So this plugin wraps
`window.fetch` and, for `FindScenes` / `FindScenesForSelect` requests carrying
a `q`:

1. Runs a cheap probe asking which scenes (within the page's active filters)
   have a Studio Code containing the term. **If none do, the original request
   is sent completely untouched.**
2. Otherwise it resolves the normal `q` matches, adds the code matches, applies
   the requested sort order, takes the requested page, and sends the request
   with those scene ids instead of `q`. Stash ignores sorting/paging when given
   explicit ids, so the plugin does that itself and then restores the correct
   total count / size / duration in the response.

Other active filters (tags, performers, organized, ...) still apply to both the
normal matches and the code matches. No backend or database changes are made.

## Settings

- **Minimum search length (characters)** - search terms shorter than this are
  left as a plain search (default: 2 if unset/0).

To turn the feature off, use the plugin's own "Disable" button in
Settings > Plugins.

## Known limitations

- Code matching is a case-insensitive substring match (`INCLUDES`) on the
  whole search term, so a multi-word search only matches codes containing that
  exact text.
- When a code matches, an extra few small id-only queries are made per search.

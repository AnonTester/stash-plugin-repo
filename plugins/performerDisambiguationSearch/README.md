# Performer Disambiguation Search

Extends every performer search/autocomplete in the Stash UI to also match the
**Disambiguation** field, not just name and aliases.

Covers:
- The search box on the Performers page.
- The performer picker used when adding/editing performers on scenes,
  galleries, images, groups, markers, and the "Performers" filter criterion
  picker on any list page - since they all share the same
  `FindPerformersForSelect` query.

## How it works

Stash's GraphQL schema already supports filtering performers by
`disambiguation` via `PerformerFilterType` - it's just that the plain search
box only ever sends a `q` (name/alias) search term, never a `performer_filter`.

This plugin loads a small script (`ui.javascript`) that wraps `window.fetch`
and rewrites outgoing `FindPerformers` / `FindPerformersForSelect` GraphQL
requests: when it sees a plain `filter.q` search term and no advanced filter
already set, it replaces it with a `performer_filter` that OR's
`name` / `aliases` / `disambiguation` together (all using the `INCLUDES`
case-insensitive partial-match modifier), e.g. searching "cyber" returns every
performer whose name, alias, or disambiguation contains "cyber" anywhere
(such as performers disambiguated as "Cyberpunk 2077").

No backend/database changes are made - this only changes what the browser
sends to the existing GraphQL API.

## Settings

- **Minimum search length (characters)** - search terms shorter than this are
  left as a plain name search (default: 2 if unset/0).

To turn the feature off entirely, use the plugin's own "Disable" button in
Settings > Plugins (no extra "enabled" toggle is needed).

## Known limitation

Stash's `INCLUDES` string filter matches multi-word search terms by OR-ing
the individual words together rather than requiring the exact phrase (this is
existing Stash behaviour for any field, not something this plugin changes).
So searching "resident evil" will also surface anything containing just
"evil" (e.g. a performer disambiguated "Devil May Cry" or "The Evil Within").
Single-word searches (e.g. "cyber", "resident") match as a normal substring.

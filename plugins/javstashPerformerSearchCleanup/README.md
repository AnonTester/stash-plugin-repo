# JAVStash Performer Search Cleanup

Makes **performer searches against the JAVStash stash-box** usable: the performer page's **Scrape with → JAVStash** dialog and the performer tagger's search box.

**Scope:** JAVStash performer searches only. Scene searches, scene scraping, and every other stash-box (StashDB, ThePornDB, FansDB, ...) are not touched.

## What it fixes

JAVStash's performer search has three quirks:

- **Word order.** A name only matches in the order stored on the site. `Nene Yokosuka` finds the performer, `Yokosuka Nene` returns nothing relevant.
- **Padding.** When nothing matches, JAVStash fills the answer with the same fixed list of unrelated western performers, so "no match" looks like ten wrong matches.
- **Kanji/kana.** A Japanese-name search returns every performer sharing one character with the search term.

## What it does

For a JAVStash performer search it:

1. also runs the search with the words reversed (when the term has two or more words) and merges both answers,
2. drops every result whose name, disambiguation or aliases do not resemble the search term (same words in any order, a near-identical spelling, the term as part of the name, or every search word present in the name),
3. orders the rest, best match first.

If nothing resembles the search term the dialog shows **No results found**, which is the correct answer when the performer is not on JAVStash.

## How it works

Stash sends the search as a `ScrapeSinglePerformer` GraphQL request with a stash-box endpoint and a text query. The plugin wraps the browser's `fetch`, recognises only that request for `javstash.org`, sends the original and the reversed query, filters/merges the replies and hands Stash the result. Every other request passes through unchanged. If anything goes wrong it falls back to the unmodified request.

## Limitations

- Only the `javstash.org` endpoint is handled. To cover another stash-box, change the `ENDPOINT` constant at the top of the script.
- It can only filter what JAVStash returns (its answer is capped at about ten performers); a performer JAVStash does not list for a term cannot be found by this plugin.
- Kanji and kana are compared character by character, so a different reading or spelling of a Japanese name is not recognised as the same name.
- No settings.

## Installation

Install from the plugin source (see the repository README), or copy `javstashPerformerSearchCleanup.yml` and `javstashPerformerSearchCleanup.js` into `<plugins-dir>/javstashPerformerSearchCleanup/`, then reload plugins and the page.

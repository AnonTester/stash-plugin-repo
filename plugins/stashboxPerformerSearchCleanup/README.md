# Stash-box Performer Search Cleanup

Makes **performer searches against the stash-boxes** return what was asked for: the performer page's **Scrape with → <stash-box>** dialog and the performer tagger's search box.

**Scope:** performer searches on every configured stash-box. Scene searches and scene scraping are not touched.

## What it fixes

**Several words are an OR search.** StashDB, FansDB and JAVStash return every performer matching *any* of the words. Searching `atsumi pear` on StashDB lists `Pear`, `Atsumi Kato`, `Anthony Pear` and `Pear TV`, although no performer is called Atsumi Pear.

**JAVStash also has three quirks of its own:**

- **Word order.** A name only matches in the order stored on the site. `Nene Yokosuka` finds the performer, `Yokosuka Nene` returns nothing relevant.
- **Padding.** When nothing matches, JAVStash fills the answer with the same fixed list of unrelated western performers.
- **Kanji/kana.** A Japanese-name search returns every performer sharing one character with the search term.

## What it does

- **Stash-boxes other than JAVStash**, for a search with two or more words: keeps a performer only if every search word is found in the performer's name, or every word in one single alias. A word matches the start of a word (`kato atsum` finds `Atsumi Kato`), in any order, ignoring case and accents. Name words and alias words are never combined, and neither are two different aliases. One-word searches are unchanged.
- **JAVStash**, for every search: also runs the reversed word order (two or more words) and merges both answers, drops every result whose name, disambiguation or aliases do not resemble the search term (same words in any order, near-identical spelling, the term as part of the name, or all search words present), and orders the rest best match first.

If nothing qualifies, the dialog shows **No results found**, which is the correct answer when the performer is not on that stash-box.

## How it works

Stash sends the search as a `ScrapeSinglePerformer` GraphQL request with a stash-box endpoint and a text query. The plugin wraps the browser's `fetch`, recognises only that request, filters the reply and hands Stash the result. Searches by stash-box ID (used by Performer Refresh) and every other request pass through unchanged. If anything goes wrong it falls back to the unmodified request.

## Limitations

- It can only filter what the stash-box returns (the answer is capped at about ten performers), so a performer the stash-box does not list for a term cannot be found by this plugin.
- The strict rule for the non-JAVStash stash-boxes expects each word to be spelled right or to be the start of a word; a misspelled word finds nothing.
- Kanji and kana on JAVStash are compared character by character, so a different reading or spelling of a Japanese name is not recognised as the same name.
- No settings.

## Installation

Install from the plugin source (see the repository README), or copy `stashboxPerformerSearchCleanup.yml` and `stashboxPerformerSearchCleanup.js` into `<plugins-dir>/stashboxPerformerSearchCleanup/`, then reload plugins and the page.

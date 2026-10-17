/**
 * JAVStash Performer Search Cleanup
 *
 * Scope: performer searches against the JAVStash stash-box only (javstash.org) -- Stash's performer
 * "Scrape with -> JAVStash" dialog and the performer tagger's search box. Scene searches and every other
 * stash-box (StashDB, TPDB, FansDB, ...) are never touched.
 *
 * Those searches reach Stash as ScrapeSinglePerformer{source:{stash_box_endpoint}, input:{query}}, which Stash
 * forwards to JAVStash's searchPerformer. JAVStash's answer is hard to use in three ways:
 *   - a name only matches in the word order stored on the site ("Nene Yokosuka" finds her,
 *     "Yokosuka Nene" returns nothing relevant),
 *   - when nothing matches it pads the answer with the same fixed list of unrelated western performers,
 *   - kanji/kana searches return every performer sharing a single character.
 * This wraps window.fetch for those calls only: it also queries the reversed word order, merges the results,
 * drops results whose name/aliases do not resemble the search term, and ranks the rest. Every other request
 * passes through untouched.
 */
(function () {
  'use strict';
  if (window.__javstashPerformerSearchCleanup) return;
  window.__javstashPerformerSearchCleanup = true;

  // Only this stash-box's performer search is filtered (substring match on the endpoint URL).
  const ENDPOINT = 'javstash.org';
  const KEEP_SCORE = 0.78;
  const LOG = '[javstash-performer-search-cleanup]';

  const origFetch = window.fetch.bind(window);

  function normalize(s) {
    return String(s || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[・·•.,'’"`´\-_/\\()[\]{}]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  function ratio(a, b) {
    const m = Math.max(a.length, b.length);
    if (!m) return 0;
    const r = 1 - lev(a, b) / m;
    // Very short strings must be identical, one edit would otherwise be enough to match anything.
    return m <= 3 && r < 1 ? 0 : r;
  }

  // How well one candidate string (a name or alias) matches the search tokens: 0..1.
  function scoreCandidate(qTokens, candidate) {
    const cTokens = normalize(candidate);
    if (!cTokens.length || !qTokens.length) return 0;
    const qSorted = [...qTokens].sort().join('');
    const cSorted = [...cTokens].sort().join('');
    const qCompact = qTokens.join('');
    const cCompact = cTokens.join('');
    // Same words in any order -> exact.
    if (qSorted === cSorted || qCompact === cCompact) return 1;
    let best = Math.max(ratio(qSorted, cSorted), ratio(qCompact, cCompact));
    // Search term is part of the candidate ("Wakana" -> "Amane Wakana", 渋谷あかね -> 渋谷あかね子).
    if (qCompact.length >= 2 && cCompact.includes(qCompact)) best = Math.max(best, 0.85);
    // Every search word has a (near) equal word in the candidate, in any order.
    let exact = true;
    const covered = qTokens.every((qt) => {
      let hit = 0;
      for (const ct of cTokens) {
        const r = qt === ct ? 1 : ratio(qt, ct);
        if (r > hit) hit = r;
      }
      if (hit < 1) exact = false;
      return hit >= 0.8;
    });
    if (covered) best = Math.max(best, exact ? 0.9 : 0.8);
    return best;
  }

  function scorePerformer(qTokens, performer) {
    const names = [performer.name];
    if (performer.disambiguation) names.push(performer.name + ' ' + performer.disambiguation);
    if (performer.aliases) names.push(...String(performer.aliases).split(/\s*,\s*/));
    let best = 0;
    for (const n of names) best = Math.max(best, scoreCandidate(qTokens, n));
    return best;
  }

  function performerKey(p) {
    return p.remote_site_id || (p.name + '|' + ((p.urls && p.urls[0]) || ''));
  }

  // The request body as a plain object, or null when this call is not one we handle.
  async function readBody(input, init) {
    try {
      const url = typeof input === 'string' ? input : input && input.url;
      if (!url || !String(url).includes('/graphql')) return null;
      let text = null;
      if (init && typeof init.body === 'string') text = init.body;
      else if (!init && input instanceof Request) text = await input.clone().text();
      if (!text || !text.includes('scrapeSinglePerformer')) return null;
      const body = JSON.parse(text);
      if (Array.isArray(body)) return null;
      const v = body.variables || {};
      const endpoint = v.source && v.source.stash_box_endpoint;
      const query = v.input && v.input.query;
      if (!endpoint || typeof query !== 'string' || !query.trim()) return null;
      if (!endpoint.includes(ENDPOINT)) return null;
      return body;
    } catch (e) {
      return null;
    }
  }

  async function runQuery(input, init, body, query) {
    const variant = JSON.parse(JSON.stringify(body));
    variant.variables.input.query = query;
    const headers = (init && init.headers) || (input instanceof Request ? input.headers : undefined);
    const res = await origFetch(typeof input === 'string' ? input : input.url, {
      method: 'POST',
      headers,
      credentials: (init && init.credentials) || 'same-origin',
      body: JSON.stringify(variant),
    });
    return res.json();
  }

  window.fetch = async function (input, init) {
    const body = await readBody(input, init);
    if (!body) return origFetch(input, init);
    try {
      const query = body.variables.input.query.trim();
      const qTokens = normalize(query);
      const queries = [query];
      if (qTokens.length >= 2) {
        const swapped = query.split(/\s+/).reverse().join(' ');
        if (swapped.toLowerCase() !== query.toLowerCase()) queries.push(swapped);
      }
      const results = await Promise.all(queries.map((q) => runQuery(input, init, body, q)));
      if (results.some((r) => r.errors)) return origFetch(input, init); // let Stash show its own error
      const seen = new Set();
      const merged = [];
      for (const r of results) {
        for (const p of (r.data && r.data.scrapeSinglePerformer) || []) {
          const k = performerKey(p);
          if (seen.has(k)) continue;
          seen.add(k);
          merged.push(p);
        }
      }
      const kept = merged
        .map((p, i) => ({ p, i, s: scorePerformer(qTokens, p) }))
        .filter((x) => x.s >= KEEP_SCORE)
        .sort((a, b) => b.s - a.s || a.i - b.i)
        .map((x) => x.p);
      console.info(LOG, JSON.stringify(query), 'queries:', queries.length, 'results:', merged.length, '-> kept:', kept.length);
      return new Response(JSON.stringify({ data: { scrapeSinglePerformer: kept } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.warn(LOG, 'falling back to the unfiltered request:', e);
      return origFetch(input, init);
    }
  };
})();

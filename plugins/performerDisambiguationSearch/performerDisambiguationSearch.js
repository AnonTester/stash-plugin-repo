(function () {
  "use strict";

  const PLUGIN_ID = "performerDisambiguationSearch";
  const LOG_PREFIX = "[PerformerDisambiguationSearch]";
  const PATCHED_OPERATIONS = new Set(["FindPerformers", "FindPerformersForSelect"]);
  const DEFAULTS = { minQueryLength: 2 };

  const { fetch: nextFetch } = window;

  let settings = { ...DEFAULTS };

  // Stash's INCLUDES modifier ORs together the words of a multi-word value, so
  // the term is split into words here and every word has to match somewhere
  // (name, aliases or disambiguation - different words may match different
  // fields), mirroring how the plain "q" search treats multiple words.
  //
  // A filter node can only carry one AND/OR/NOT, so "every word matches one of
  // three fields" (an AND of ORs) can't be written directly. Via De Morgan it
  // is expressed as: NOT(word1 matches nothing OR word2 matches nothing OR ...),
  // where "matches nothing" is name/aliases/disambiguation all EXCLUDES the
  // word (fields within one node are AND'd together).
  function buildFilter(term) {
    const words = term.split(/\s+/).map((w) => w.replace(/^"+|"+$/g, "")).filter(Boolean);
    if (words.length <= 1) {
      const word = words[0] || term;
      return {
        name: { value: word, modifier: "INCLUDES" },
        OR: {
          aliases: { value: word, modifier: "INCLUDES" },
          OR: {
            disambiguation: { value: word, modifier: "INCLUDES" },
          },
        },
      };
    }

    const matchesNothing = (word) => ({
      name: { value: word, modifier: "EXCLUDES" },
      aliases: { value: word, modifier: "EXCLUDES" },
      disambiguation: { value: word, modifier: "EXCLUDES" },
    });
    let chain = matchesNothing(words[words.length - 1]);
    for (let i = words.length - 2; i >= 0; i--) {
      chain = { ...matchesNothing(words[i]), OR: chain };
    }
    return { NOT: chain };
  }

  // The frontend always sends performer_filter as `{}` when no advanced
  // filter is active - it is never omitted/null, so truthiness alone can't
  // be used to detect "no filter set".
  function isEmptyFilter(filter) {
    return !filter || typeof filter !== "object" || Object.keys(filter).length === 0;
  }

  // Mutates a FindPerformers/FindPerformersForSelect `variables` object in place
  // so the search also matches disambiguation. Returns true if it changed anything.
  function patchVariables(variables) {
    if (!variables || typeof variables !== "object") return false;
    // Don't touch requests that already carry an explicit performer_filter
    // (e.g. the advanced filter panel on the Performers page) - we only want
    // to extend the plain quick-search box.
    if (!isEmptyFilter(variables.performer_filter)) return false;

    const filter = variables.filter;
    const term = filter && typeof filter.q === "string" ? filter.q.trim() : "";
    if (!term || term.length < settings.minQueryLength) return false;

    variables.performer_filter = buildFilter(term);
    // The server ignores `q` once performer_filter is set, but clear it
    // explicitly so behaviour doesn't depend on that being the case.
    variables.filter = { ...filter, q: "" };
    return true;
  }

  window.fetch = async function (resource, config) {
    if (
      config &&
      typeof config.body === "string" &&
      typeof resource === "string" &&
      resource.endsWith("/graphql")
    ) {
      try {
        const payload = JSON.parse(config.body);
        if (payload && PATCHED_OPERATIONS.has(payload.operationName)) {
          if (patchVariables(payload.variables)) {
            config = { ...config, body: JSON.stringify(payload) };
          }
        }
      } catch (e) {
        console.error(LOG_PREFIX, "failed to inspect/patch outgoing request", e);
      }
    }
    return nextFetch(resource, config);
  };

  async function loadSettings() {
    try {
      const res = await nextFetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationName: "PerformerDisambiguationSearchSettings",
          query:
            "query PerformerDisambiguationSearchSettings { configuration { plugins } }",
        }),
      });
      const json = await res.json();
      const saved = (json && json.data && json.data.configuration.plugins[PLUGIN_ID]) || {};
      settings = {
        minQueryLength: Number.isFinite(saved.minQueryLength)
          ? saved.minQueryLength
          : DEFAULTS.minQueryLength,
      };
    } catch (e) {
      console.error(LOG_PREFIX, "failed to load plugin settings, using defaults", e);
    }
  }

  loadSettings();
})();

(function () {
  "use strict";

  const PLUGIN_ID = "performerDisambiguationSearch";
  const LOG_PREFIX = "[PerformerDisambiguationSearch]";
  const PATCHED_OPERATIONS = new Set(["FindPerformers", "FindPerformersForSelect"]);
  const DEFAULTS = { minQueryLength: 2 };

  const { fetch: nextFetch } = window;

  let settings = { ...DEFAULTS };

  // Builds a performer_filter that OR's name/aliases/disambiguation together,
  // matching the behaviour of the plain "q" search but extended to disambiguation.
  function buildOrFilter(term) {
    return {
      name: { value: term, modifier: "INCLUDES" },
      OR: {
        aliases: { value: term, modifier: "INCLUDES" },
        OR: {
          disambiguation: { value: term, modifier: "INCLUDES" },
        },
      },
    };
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

    variables.performer_filter = buildOrFilter(term);
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

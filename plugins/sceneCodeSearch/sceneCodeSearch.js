(function () {
  "use strict";

  const PLUGIN_ID = "sceneCodeSearch";
  const LOG_PREFIX = "[SceneCodeSearch]";
  const DEFAULTS = { minQueryLength: 2 };

  // operation name -> the variable that operation declares for restricting
  // results to a list of ids
  const PATCHED_OPERATIONS = {
    FindScenes: (ids) => ({ scene_ids: ids }),
    FindScenesForSelect: (ids) => ({ ids: ids.map(String) }),
  };

  const { fetch: nextFetch } = window;

  let settings = { ...DEFAULTS };

  // Stash's plain `q` scene search covers title/details/path/etc. but not the
  // scene's code, and a `q` can't be OR'd with a scene_filter. So when the
  // term matches some scenes' codes we resolve the full result set to scene
  // ids ourselves (normal `q` matches + code matches, within the active
  // filters) and send those via `scene_ids`/`ids` instead of `q`.
  //
  // Stash ignores sort and paging when given explicit ids and just returns
  // them in the order given, so we also do the sorting and paging here, and
  // patch the totals in the response afterwards.
  const IDS_QUERY =
    "query SceneCodeSearchIds($filter: FindFilterType, $scene_filter: SceneFilterType, $scene_ids: [Int!]) {" +
    " findScenes(filter: $filter, scene_filter: $scene_filter, scene_ids: $scene_ids) { count filesize duration scenes { id } } }";

  function isEmptyFilter(filter) {
    return !filter || typeof filter !== "object" || Object.keys(filter).length === 0;
  }

  async function runQuery(resource, config, variables) {
    const res = await nextFetch(resource, {
      ...config,
      body: JSON.stringify({
        operationName: "SceneCodeSearchIds",
        query: IDS_QUERY,
        variables,
      }),
    });
    const json = await res.json();
    if (!json || !json.data || json.errors) {
      throw new Error("ids query failed: " + JSON.stringify(json && json.errors));
    }
    return json.data.findScenes;
  }

  const fetchIds = async (resource, config, variables) =>
    (await runQuery(resource, config, variables)).scenes.map((s) => Number(s.id));

  // Returns { variables, fixup } to send instead of the original, or null to
  // send the request as-is.
  async function buildPatch(resource, config, operationName, variables) {
    if (!variables || typeof variables !== "object") return null;
    // Id lookups (e.g. the select showing already-chosen scenes) carry no search.
    if (Array.isArray(variables.ids) && variables.ids.length) return null;

    const filter = variables.filter;
    const term = filter && typeof filter.q === "string" ? filter.q.trim() : "";
    if (!term || term.length < settings.minQueryLength) return null;

    const base = {
      scene_filter: variables.scene_filter,
      scene_ids: variables.scene_ids,
    };
    const unpaged = { ...filter, page: 1, per_page: -1 };

    // 1. Cheap probe: which scenes (within the active filters) have a matching code?
    const codeCriterion = { value: term, modifier: "INCLUDES" };
    const codeFilter = isEmptyFilter(variables.scene_filter)
      ? { code: codeCriterion }
      : { code: codeCriterion, AND: variables.scene_filter };
    const codeIds = await fetchIds(resource, config, {
      ...base,
      filter: { per_page: -1 },
      scene_filter: codeFilter,
    });
    if (!codeIds.length) return null; // nothing extra to add - leave request untouched

    // 2. Scenes the normal search would have returned.
    const qIds = await fetchIds(resource, config, { ...base, filter: unpaged });
    const wanted = new Set([...qIds, ...codeIds]);

    // 3. Everything within the active filters in the requested sort order,
    //    reduced to the wanted scenes - gives us correct ordering to page over.
    const ordered = (
      await fetchIds(resource, config, { ...base, filter: { ...unpaged, q: "" } })
    ).filter((id) => wanted.has(id));

    const perPage = Number.isFinite(filter.per_page) ? filter.per_page : 25;
    const page = Number.isFinite(filter.page) && filter.page > 0 ? filter.page : 1;
    const pageIds = perPage < 0 ? ordered : ordered.slice((page - 1) * perPage, page * perPage);

    const patched = {
      ...variables,
      filter: { ...filter, q: "" },
      ...PATCHED_OPERATIONS[operationName](pageIds),
    };

    // 4. The response would now describe just the requested page; restore the totals.
    const fixup = async (json) => {
      const result = json && json.data && json.data.findScenes;
      if (!result) return;
      result.count = ordered.length;
      if ("filesize" in result || "duration" in result) {
        const totals = await runQuery(resource, config, {
          filter: { per_page: 1 },
          scene_ids: ordered,
        });
        if ("filesize" in result) result.filesize = totals.filesize;
        if ("duration" in result) result.duration = totals.duration;
      }
    };

    return { variables: patched, fixup };
  }

  window.fetch = async function (resource, config) {
    let patch = null;
    if (
      config &&
      typeof config.body === "string" &&
      typeof resource === "string" &&
      resource.endsWith("/graphql")
    ) {
      try {
        const payload = JSON.parse(config.body);
        if (payload && Object.hasOwn(PATCHED_OPERATIONS, payload.operationName)) {
          patch = await buildPatch(resource, config, payload.operationName, payload.variables);
          if (patch) {
            config = {
              ...config,
              body: JSON.stringify({ ...payload, variables: patch.variables }),
            };
          }
        }
      } catch (e) {
        console.error(LOG_PREFIX, "failed to inspect/patch outgoing request", e);
        patch = null;
      }
    }

    const response = await nextFetch(resource, config);
    if (!patch) return response;

    try {
      const json = await response.clone().json();
      await patch.fixup(json);
      return new Response(JSON.stringify(json), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (e) {
      console.error(LOG_PREFIX, "failed to restore result totals", e);
      return response;
    }
  };

  async function loadSettings() {
    try {
      const res = await nextFetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationName: "SceneCodeSearchSettings",
          query: "query SceneCodeSearchSettings { configuration { plugins } }",
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

(function () {
  "use strict";

  const PLUGIN_ID = "scene-refresh";
  const ATTR = `data-${PLUGIN_ID}`;
  const BTN_CLASS = `${PLUGIN_ID}-btn`;

  // ── GraphQL ──────────────────────────────────────────────────────────────

  async function gql(query, variables) {
    const res = await fetch("/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data;
  }

  async function fetchStashBoxes() {
    const data = await gql(
      `query SRGetConfig { configuration { general { stashBoxes { endpoint name } } } }`
    );
    return data?.configuration?.general?.stashBoxes ?? [];
  }

  async function fetchSceneBasic(id) {
    const data = await gql(
      `query SRFindSceneBasic($id: ID!) { findScene(id: $id) { id stash_ids { endpoint stash_id } } }`,
      { id }
    );
    return data?.findScene;
  }

  async function fetchScene(id) {
    const data = await gql(
      `query SRFindScene($id: ID!) {
        findScene(id: $id) {
          id title code date director details urls
          studio { id name }
          performers { id name }
          tags { id name }
          stash_ids { endpoint stash_id }
          paths { screenshot }
        }
      }`,
      { id }
    );
    return data?.findScene;
  }

  // Scrapes exactly one stash-box scene by its ID (input.query takes the stash-box UUID, which the
  // stash-box looks up directly). Returns the ScrapedScene whose remote_site_id is that ID.
  async function fetchScraped(remoteStashId, endpoint) {
    const data = await gql(
      `query SRScrapeScene($source: ScraperSourceInput!, $input: ScrapeSingleSceneInput!) {
        scrapeSingleScene(source: $source, input: $input) {
          title code date director details urls image remote_site_id
          studio { name stored_id }
          performers { name stored_id }
          tags { name stored_id }
        }
      }`,
      { source: { stash_box_endpoint: endpoint }, input: { query: remoteStashId } }
    );
    const list = data?.scrapeSingleScene ?? [];
    return list.find((s) => s.remote_site_id === remoteStashId) ?? list[0] ?? null;
  }

  async function saveUpdate(input) {
    const data = await gql(
      `mutation SRSceneUpdate($input: SceneUpdateInput!) { sceneUpdate(input: $input) { id } }`,
      { input }
    );
    return data?.sceneUpdate;
  }

  // ── Small helpers ────────────────────────────────────────────────────────

  function showToast(msg, type = "info") {
    let c = document.getElementById(`${PLUGIN_ID}-toasts`);
    if (!c) {
      c = document.createElement("div");
      c.id = `${PLUGIN_ID}-toasts`;
      document.body.appendChild(c);
    }
    const el = document.createElement("div");
    el.className = `${PLUGIN_ID}-toast ${PLUGIN_ID}-toast--${type}`;
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => el.classList.add(`${PLUGIN_ID}-toast--out`), 3800);
    setTimeout(() => el.remove(), 4100);
  }

  function refreshSVG(size = 14) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>`;
  }

  function el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "className") e.className = v;
      else if (k === "textContent") e.textContent = v;
      else e.setAttribute(k, v);
    }
    for (const c of [].concat(children)) if (c) e.append(c);
    return e;
  }

  const isBlank = (v) => v == null || v === "" || (Array.isArray(v) && !v.length);
  const sameText = (a, b) => String(a ?? "").trim() === String(b ?? "").trim();

  // A visible Save button means the scene Edit form is open (its unsaved changes are lost on reload).
  function editFormOpen() {
    return Array.from(document.querySelectorAll("button.edit-button")).some(
      (b) => /^save$/i.test((b.textContent || "").trim()) && b.offsetParent !== null
    );
  }

  // ── Dialog ───────────────────────────────────────────────────────────────

  // One entry per updatable field. `checkedByDefault` is true when the scraped value is present and
  // differs from the scene's current value. `apply(input)` writes the chosen value into the update input.
  function buildFields(scene, scraped) {
    const fields = [];

    const text = (key, label) => {
      const value = scraped[key];
      if (isBlank(value)) return;
      fields.push({
        label,
        newView: () => el("span", { textContent: String(value) }),
        oldText: scene[key],
        same: sameText(value, scene[key]),
        apply: (input) => { input[key] = value; },
      });
    };
    text("title", "Title");
    text("code", "Studio Code");
    text("date", "Date");
    text("director", "Director");
    text("details", "Details");

    if (!isBlank(scraped.urls)) {
      const existing = scene.urls ?? [];
      const added = scraped.urls.filter((u) => !existing.includes(u));
      fields.push({
        label: "URLs",
        newView: () =>
          el("ul", {}, scraped.urls.map((u) => el("li", { textContent: u + (existing.includes(u) ? "" : "  (new)") }))),
        oldText: existing.join("\n"),
        same: !added.length,
        note: "added to the existing URLs",
        apply: (input) => { input.urls = [...existing, ...added]; },
      });
    }

    if (scraped.studio?.name) {
      const matched = !!scraped.studio.stored_id;
      fields.push({
        label: "Studio",
        newView: () => el("span", { textContent: scraped.studio.name + (matched ? "" : "  (not in library)") }),
        oldText: scene.studio?.name,
        same: matched && scraped.studio.stored_id === scene.studio?.id,
        disabled: !matched,
        apply: (input) => { input.studio_id = scraped.studio.stored_id; },
      });
    }

    const merged = (key, label, list, existingList) => {
      if (isBlank(list)) return;
      const matched = list.filter((x) => x.stored_id);
      const unmatched = list.filter((x) => !x.stored_id);
      const existingIds = new Set(existingList.map((x) => x.id));
      const toAdd = matched.filter((x) => !existingIds.has(x.stored_id));
      fields.push({
        label,
        newView: () =>
          el("div", {}, [
            el("ul", {}, matched.map((x) => el("li", { textContent: x.name + (existingIds.has(x.stored_id) ? "" : "  (new)") }))),
            unmatched.length
              ? el("div", { className: `${PLUGIN_ID}-skip`, textContent: `Not in library, skipped: ${unmatched.map((x) => x.name).join(", ")}` })
              : null,
          ]),
        oldText: existingList.map((x) => x.name).join(", "),
        same: !toAdd.length,
        disabled: !matched.length,
        note: "added to the existing ones",
        apply: (input) => { input[key] = [...existingList.map((x) => x.id), ...toAdd.map((x) => x.stored_id)]; },
      });
    };
    merged("performer_ids", "Performers", scraped.performers, scene.performers ?? []);
    merged("tag_ids", "Tags", scraped.tags, scene.tags ?? []);

    if (scraped.image) {
      fields.push({
        label: "Cover image",
        newView: () => el("img", { className: `${PLUGIN_ID}-cover`, src: scraped.image, alt: "Scraped cover" }),
        oldView: scene.paths?.screenshot
          ? el("img", { className: `${PLUGIN_ID}-cover`, src: scene.paths.screenshot, alt: "Current cover" })
          : null,
        same: false,
        apply: (input) => { input.cover_image = scraped.image; },
      });
    }

    return fields;
  }

  function openDialog(scene, scraped, endpointName) {
    const fields = buildFields(scene, scraped);
    const overlay = el("div", { className: `${PLUGIN_ID}-overlay` });
    const close = () => { overlay.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });

    const body = el("div", { className: `${PLUGIN_ID}-body` });
    if (editFormOpen()) {
      body.append(el("div", {
        className: `${PLUGIN_ID}-warning`,
        textContent: "The Edit form is open. Updating saves straight to the scene and reloads the page, so any unsaved changes in the form are lost.",
      }));
    }
    if (!fields.length) body.append(el("p", { textContent: `${endpointName} returned no data for this scene.` }));

    const checks = [];
    for (const f of fields) {
      const cb = el("input", { type: "checkbox" });
      cb.checked = !f.same && !f.disabled;
      cb.disabled = !!f.disabled;
      checks.push([cb, f]);
      const right = el("div", { className: `${PLUGIN_ID}-new` }, [
        f.newView(),
        f.note ? el("div", { className: `${PLUGIN_ID}-old`, textContent: f.note }) : null,
        f.oldView
          ? el("div", { className: `${PLUGIN_ID}-old` }, [el("div", { textContent: "Current:" }), f.oldView])
          : !isBlank(f.oldText) && !f.same
            ? el("div", { className: `${PLUGIN_ID}-old`, textContent: `Current: ${f.oldText}` })
            : null,
      ]);
      body.append(el("div", { className: `${PLUGIN_ID}-row${f.same ? " is-same" : ""}` }, [
        cb,
        el("div", { className: `${PLUGIN_ID}-label`, textContent: f.label }),
        right,
      ]));
    }

    const cancel = el("button", { type: "button", className: "btn btn-secondary", textContent: "Cancel" });
    cancel.addEventListener("click", close);
    const save = el("button", { type: "button", className: "btn btn-success", textContent: "Update scene" });
    save.disabled = !fields.length;
    save.addEventListener("click", async () => {
      const input = { id: scene.id };
      let n = 0;
      for (const [cb, f] of checks) if (cb.checked) { f.apply(input); n++; }
      if (!n) { showToast("Nothing selected", "info"); return; }
      save.disabled = true;
      save.textContent = "Saving...";
      try {
        await saveUpdate(input);
        showToast("Scene updated", "success");
        close();
        setTimeout(() => window.location.reload(), 500);
      } catch (err) {
        showToast(`Error: ${err.message}`, "error");
        save.disabled = false;
        save.textContent = "Update scene";
      }
    });

    overlay.append(el("div", { className: `${PLUGIN_ID}-dialog`, role: "dialog" }, [
      el("div", { className: `${PLUGIN_ID}-header`, textContent: `Update scene from ${endpointName}` }),
      body,
      el("div", { className: `${PLUGIN_ID}-footer` }, [cancel, save]),
    ]));
    document.body.append(overlay);
  }

  // ── Button ───────────────────────────────────────────────────────────────

  function makeButton(sceneId, remoteStashId, endpoint, endpointName) {
    const btn = el("button", { type: "button", className: `btn minimal ${BTN_CLASS}`, title: `Update from ${endpointName}` });
    btn.setAttribute(ATTR, endpoint);
    btn.innerHTML = refreshSVG();

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      btn.innerHTML = `<span class="${PLUGIN_ID}-spinner" aria-hidden="true"></span>`;
      try {
        const [scene, scraped] = await Promise.all([fetchScene(sceneId), fetchScraped(remoteStashId, endpoint)]);
        if (!scraped) { showToast(`${endpointName} returned no data for this ID`, "error"); return; }
        openDialog(scene, scraped, endpointName);
      } catch (err) {
        showToast(`Error: ${err.message}`, "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = refreshSVG();
      }
    });
    return btn;
  }

  // ── Injection ────────────────────────────────────────────────────────────

  // Scene data is fetched once per scene page; pills are then handled synchronously (check, mark and insert in
  // one tick), so overlapping scans can never put two buttons next to one stash ID.
  let dataFor = null;   // { sceneId, promise }

  function sceneData(sceneId) {
    if (!dataFor || dataFor.sceneId !== sceneId) {
      dataFor = {
        sceneId,
        promise: Promise.all([fetchSceneBasic(sceneId), fetchStashBoxes()]).then(([scene, boxes]) => ({ scene, boxes })),
      };
      dataFor.promise.catch(() => { if (dataFor?.sceneId === sceneId) dataFor = null; });
    }
    return dataFor.promise;
  }

  function resolveEndpoint(pill, scene, boxes) {
    const byName = Object.fromEntries(boxes.map((b) => [b.name, b.endpoint]));
    const link = pill.querySelector("a");
    let endpoint = byName[pill.dataset?.endpoint] ?? null;
    if (!endpoint && link) {
      endpoint = scene.stash_ids.find((s) => link.href.includes(s.stash_id))?.endpoint ?? null;
    }
    if (!endpoint && link) {
      endpoint = scene.stash_ids.find((s) => link.href.startsWith(s.endpoint.replace(/\/graphql$/, "")))?.endpoint ?? null;
    }
    return endpoint;
  }

  async function scan() {
    const m = window.location.pathname.match(/^\/scenes\/(\d+)/);
    if (!m) return;
    if (!document.querySelector(`.stash-id-pill:not([${ATTR}])`)) return;
    const sceneId = m[1];
    let data;
    try {
      data = await sceneData(sceneId);
    } catch (err) {
      console.error(`[${PLUGIN_ID}]`, err);
      return;
    }
    if (!data.scene?.stash_ids?.length || window.location.pathname.match(/^\/scenes\/(\d+)/)?.[1] !== sceneId) return;

    document.querySelectorAll(`.stash-id-pill:not([${ATTR}])`).forEach((pill) => {
      const endpoint = resolveEndpoint(pill, data.scene, data.boxes);
      const entry = endpoint && data.scene.stash_ids.find((s) => s.endpoint === endpoint);
      if (!entry) return;
      pill.setAttribute(ATTR, "1");
      if (pill.nextElementSibling?.classList.contains(BTN_CLASS)) return;
      const name = data.boxes.find((b) => b.endpoint === endpoint)?.name ?? endpoint;
      const btn = makeButton(sceneId, entry.stash_id, endpoint, name);
      // After the pill's own copy button when there is one, otherwise right after the pill.
      const copyBtn =
        pill.querySelector('button[title*="opy"], button[aria-label*="opy"]') ||
        (pill.nextElementSibling?.tagName === "BUTTON" ? pill.nextElementSibling : null);
      (copyBtn ?? pill).insertAdjacentElement("afterend", btn);
    });
  }

  let timer = null;
  function scheduleScan() {
    clearTimeout(timer);
    timer = setTimeout(scan, 150);
  }

  function init() {
    // Tabs and re-renders add/replace stash-id pills at any time, so keep watching.
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    PluginApi.Event.addEventListener("stash:location", () => { dataFor = null; scheduleScan(); });
    scheduleScan();
  }

  const ready = setInterval(() => {
    if (window.PluginApi?.Event) { clearInterval(ready); init(); }
  }, 50);
})();

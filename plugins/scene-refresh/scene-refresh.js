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

  // ── Driving Stash's own scrape flow ──────────────────────────────────────

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function waitFor(fn, what, timeout = 15000) {
    const end = Date.now() + timeout;
    for (;;) {
      const v = fn();
      if (v) return v;
      if (Date.now() > end) throw new Error(`Timed out waiting for ${what}`);
      await sleep(50);
    }
  }

  const visible = (e) => e && e.offsetParent !== null;
  const visibleModal = () => document.querySelector(".modal.show");

  function scrapeWithButton() {
    return Array.from(document.querySelectorAll("button.dropdown-toggle")).find(
      (b) => visible(b) && /^scrape with/i.test((b.textContent || "").trim())
    );
  }

  async function openEditTab() {
    if (scrapeWithButton()) return;
    const tab = Array.from(document.querySelectorAll("a.nav-link")).find(
      (a) => visible(a) && ((a.getAttribute("data-rb-event-key") || "").includes("edit") || (a.textContent || "").trim() === "Edit")
    );
    if (!tab) throw new Error("Could not find the scene Edit tab");
    tab.click();
    await waitFor(scrapeWithButton, "the Edit tab");
  }

  // The magnifier button next to "Scrape with…" opens Stash's scene query: pick the stash-box, type the ID,
  // and Stash lists the matching scenes. Clicking the result opens Stash's own scrape results dialog.
  async function startNativeScrape(stashId, endpointName) {
    await openEditTab();
    const pane = scrapeWithButton().closest(".tab-pane") || document;
    const toggle = Array.from(pane.querySelectorAll("button.dropdown-toggle")).find(
      (b) => visible(b) && b.querySelector('svg[data-icon="magnifying-glass"]')
    );
    if (!toggle) throw new Error("Could not find the scene query button");
    toggle.click();
    const item = await waitFor(
      () => Array.from(document.querySelectorAll(".dropdown-menu.show .dropdown-item")).find((i) => (i.textContent || "").trim() === endpointName),
      `${endpointName} in the scrape menu`,
      5000
    );
    item.click();

    const input = await waitFor(() => document.querySelector(".modal.show .scrape-query-dialog input.text-input"), "the query dialog");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    setter.call(input, stashId);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await sleep(50);
    const modal = input.closest(".modal");
    modal.querySelector(".input-group-append button").click();

    const state = await waitFor(() => {
      const items = modal.querySelectorAll(".SceneScrapeModal-list li");
      if (items.length) return { items };
      const txt = modal.querySelector(".SceneScrapeModal-list-container")?.textContent || "";
      if (/\b0 scenes? found|no results/i.test(txt)) return { items: [] };
      return null;
    }, `${endpointName} search results`, 30000);

    if (!state.items.length) {
      Array.from(modal.querySelectorAll("button")).find((b) => /cancel/i.test(b.textContent))?.click();
      throw new Error(`${endpointName} returned no scene for this ID`);
    }
    if (state.items.length > 1) return "choose";   // let the user pick in Stash's own dialog
    state.items[0].click();
    return "done";
  }

  // ── Button ───────────────────────────────────────────────────────────────

  function makeButton(stashId, endpointName) {
    const btn = el("button", { type: "button", className: `btn minimal ${BTN_CLASS}`, title: `Scrape ${endpointName} ID with Stash's scraper` });
    btn.innerHTML = refreshSVG();

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      btn.innerHTML = `<span class="${PLUGIN_ID}-spinner" aria-hidden="true"></span>`;
      document.body.classList.add(`${PLUGIN_ID}-busy`);   // keep the query dialog out of sight while it is driven
      try {
        await startNativeScrape(stashId, endpointName);
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        document.body.classList.remove(`${PLUGIN_ID}-busy`);
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
      const btn = makeButton(entry.stash_id, name);
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

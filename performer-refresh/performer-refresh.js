(function () {
  "use strict";

  const PLUGIN_ID = "performer-refresh";
  const ATTR = `data-${PLUGIN_ID}`;

  // Inlined Font Awesome SVG paths (same icons Stash uses)
  const FA_CHECK       = "M434.8 70.1c14.3 10.4 17.5 30.4 7.1 44.7l-256 352c-5.5 7.6-14 12.3-23.4 13.1s-18.5-2.7-25.1-9.3l-128-128c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l101.5 101.5 234-321.7c10.4-14.3 30.4-17.5 44.7-7.1z";
  const FA_XMARK       = "M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z";
  const FA_ARROW_LEFT  = "M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l160 160c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L109.3 288 480 288c17.7 0 32-14.3 32-32s-14.3-32-32-32l-370.7 0 105.4-105.4c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-160 160z";
  const FA_ARROW_RIGHT = "M502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L402.7 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l370.7 0-105.4 105.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z";
  const FA_TAGS        = "M401.2 39.1L549.4 189.4c27.7 28.1 27.7 73.1 0 101.2L393 448.9c-9.3 9.4-24.5 9.5-33.9 .2s-9.5-24.5-.2-33.9L515.3 256.8c9.2-9.3 9.2-24.4 0-33.7L367 72.9c-9.3-9.4-9.2-24.6 .2-33.9s24.6-9.2 33.9 .2zM32.1 229.5L32.1 96c0-35.3 28.7-64 64-64l133.5 0c17 0 33.3 6.7 45.3 18.7l144 144c25 25 25 65.5 0 90.5L285.4 418.7c-25 25-65.5 25-90.5 0l-144-144c-12-12-18.7-28.3-18.7-45.3zm144-85.5a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z";

  function FaIcon({ viewBox, d }) {
    return PluginApi.React.createElement("svg", {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox,
      className: "svg-inline--fa fa-icon",
      "aria-hidden": "true",
      role: "img",
    }, PluginApi.React.createElement("path", { fill: "currentColor", d }));
  }

  // Convert ISO 3166-1 alpha-2 country codes to display names (e.g. "US" → "United States")
  function isoToCountryName(iso) {
    if (!iso) return null;
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(iso.toUpperCase()) || iso;
    } catch (e) {
      return iso;
    }
  }

  // Convert GenderEnum values to display names matching Stash's en-GB locale.
  // Falls back to title-casing the enum (e.g. "SOME_VALUE" → "Some Value").
  const GENDER_DISPLAY = {
    FEMALE:             "Female",
    MALE:               "Male",
    INTERSEX:           "Intersex",
    NON_BINARY:         "Non-Binary",
    TRANSGENDER_FEMALE: "Transgender Female",
    TRANSGENDER_MALE:   "Transgender Male",
  };
  function genderDisplay(v) {
    if (!v) return null;
    const key = String(v).toUpperCase();
    return GENDER_DISPLAY[key] ??
      key.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }

  // ── Field definitions ────────────────────────────────────────────────────
  //
  // Field order matches PerformerModal.tsx exactly (Tagger/PerformerModal.tsx).
  // noDefaultCheck : pre-checked = false regardless of scraped value (name)
  // scrapedKey     : key on ScrapedPerformer when different from `key`
  // performerKey   : key on local Performer when different from `key`
  // display        : formatter for display only; raw value still used in buildInput
  // noTruncate     : render value as <span> instead of <TruncatedText> (tattoos/piercings)
  // urlList        : render as <ul><li><a> list (urls)
  // skipIf(scraped): returns true to hide the row (fake_tits for male performers)

  const FIELD_DEFS = [
    { key: "name",           label: "Name",          noDefaultCheck: true },
    { key: "disambiguation", label: "Disambiguation" },
    { key: "aliases",        label: "Aliases",       performerKey: "alias_list" },
    { key: "gender",         label: "Gender",   display: v => genderDisplay(v) },
    { key: "birthdate",      label: "Birthdate" },
    { key: "death_date",     label: "Death Date" },
    { key: "ethnicity",      label: "Ethnicity" },
    {
      key: "country", label: "Country",
      display: v => isoToCountryName(v),
    },
    { key: "hair_color",     label: "Hair Colour" },
    { key: "eye_color",      label: "Eye Colour" },
    {
      key: "height_cm", scrapedKey: "height", label: "Height",
      display: v => v != null ? String(v) : null,
    },
    { key: "weight",       label: "Weight" },
    { key: "measurements", label: "Measurements" },
    {
      key: "fake_tits", label: "Fake Tits",
      skipIf: scraped => scraped.gender?.toUpperCase() === "MALE",
    },
    { key: "career_start", label: "Career Start" },
    { key: "career_end",   label: "Career End" },
    { key: "tattoos",      label: "Tattoos",   noTruncate: true },
    { key: "piercings",    label: "Piercings", noTruncate: true },
    { key: "details",      label: "Details" },
    { key: "urls",         label: "URLs",      urlList: true },
    // Schema supports these; not in the original tagger modal but useful here
    { key: "penis_length", label: "Penis Length" },
    { key: "circumcised",  label: "Circumcised" },
  ];
  // Tags are always applied when present (not shown as a toggleable row, matching tagger)

  function scrapedVal(def, scraped)   { return scraped[def.scrapedKey || def.key]; }
  function performerVal(def, perf)    { return perf[def.performerKey || def.key]; }
  function displayVal(def, raw) {
    if (raw == null || raw === "") return null;
    if (Array.isArray(raw) && !raw.length) return null;
    return def.display ? def.display(raw) : String(raw);
  }

  function initChecked(perf, scraped) {
    const out = {};
    for (const def of FIELD_DEFS) {
      if (def.noDefaultCheck) { out[def.key] = false; continue; }
      if (def.urlList)        { out[def.key] = !!(scraped.urls?.length); continue; }
      out[def.key] = !!displayVal(def, scrapedVal(def, scraped));
    }
    return out;
  }

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

  async function fetchPerformer(id) {
    const data = await gql(
      `query PRFindPerformer($id: ID!) {
        findPerformer(id: $id) {
          id name disambiguation gender
          birthdate death_date ethnicity country
          eye_color height_cm weight measurements
          fake_tits penis_length circumcised
          career_start career_end details hair_color
          tattoos piercings
          alias_list
          urls
          image_path
          stash_ids { endpoint stash_id }
          tags { id name }
          rating100
        }
      }`,
      { id }
    );
    return data?.findPerformer;
  }

  async function fetchPerformerBasic(id) {
    const data = await gql(
      `query PRFindPerformerBasic($id: ID!) {
        findPerformer(id: $id) {
          id
          name
          stash_ids { endpoint stash_id }
        }
      }`,
      { id }
    );
    return data?.findPerformer;
  }

  async function fetchStashBoxes() {
    const data = await gql(
      `query PRGetConfig {
        configuration {
          general { stashBoxes { endpoint name } }
        }
      }`
    );
    return data?.configuration?.general?.stashBoxes ?? [];
  }

  // remoteStashId = UUID from performer.stash_ids[x].stash_id.
  // Uses input.query — matches the tagger's stashBoxPerformerQuery.
  // scrapeSinglePerformer returns [ScrapedPerformer]; take element [0].
  async function fetchScraped(remoteStashId, endpoint) {
    const data = await gql(
      `query PRScrapeSingle($source: ScraperSourceInput!, $input: ScrapeSinglePerformerInput!) {
        scrapeSinglePerformer(source: $source, input: $input) {
          stored_id
          name disambiguation gender
          birthdate death_date ethnicity country
          eye_color height weight measurements
          fake_tits penis_length circumcised
          career_start career_end details hair_color
          tattoos piercings
          aliases
          urls
          images
          tags { name stored_id }
          remote_site_id
        }
      }`,
      {
        source: { stash_box_endpoint: endpoint },
        input:  { query: remoteStashId },
      }
    );
    return data?.scrapeSinglePerformer?.[0] ?? null;
  }

  async function saveUpdate(input) {
    const data = await gql(
      `mutation PRPerformerUpdate($input: PerformerUpdateInput!) {
        performerUpdate(input: $input) { id name }
      }`,
      { input }
    );
    return data?.performerUpdate;
  }

  // ── Build PerformerUpdateInput from modal selections ──────────────────

  function buildInput(perf, scraped, checked, useImage, imgIdx) {
    const input = {
      id: perf.id,
      stash_ids: perf.stash_ids.map(s => ({ endpoint: s.endpoint, stash_id: s.stash_id })),
    };

    const passThrough = [
      "name", "disambiguation", "gender", "birthdate", "death_date",
      "ethnicity", "country", "eye_color", "hair_color", "measurements",
      "fake_tits", "circumcised", "career_start", "career_end", "details",
      "tattoos", "piercings",
    ];
    for (const f of passThrough) {
      if (checked[f] && scraped[f] != null) input[f] = scraped[f];
    }

    // ScrapedPerformer returns numeric fields as String; PerformerUpdateInput expects Int/Float
    if (checked.height_cm && scraped.height != null) {
      const v = parseInt(scraped.height, 10);
      if (!isNaN(v)) input.height_cm = v;
    }
    if (checked.weight && scraped.weight != null) {
      const v = parseInt(scraped.weight, 10);
      if (!isNaN(v)) input.weight = v;
    }
    if (checked.penis_length && scraped.penis_length != null) {
      const v = parseFloat(scraped.penis_length);
      if (!isNaN(v)) input.penis_length = v;
    }

    // ScrapedPerformer.aliases is a comma-delimited String; input expects [String!]
    if (checked.aliases && scraped.aliases) {
      input.alias_list = scraped.aliases.split(",").map(s => s.trim()).filter(Boolean);
    }

    if (checked.urls && scraped.urls?.length)
      input.urls = scraped.urls;

    // Tags are always applied when available (no toggle row, matching tagger behaviour)
    if (scraped.tags?.length) {
      const ids = scraped.tags.filter(t => t.stored_id).map(t => t.stored_id);
      if (ids.length) input.tag_ids = ids;
    }

    if (useImage && scraped.images?.[imgIdx])
      input.image = scraped.images[imgIdx];

    return input;
  }

  // ── React components ──────────────────────────────────────────────────

  // Shared toggle button used in both field rows and the image panel.
  function ToggleButton({ included, onClick }) {
    const R = PluginApi.React;
    return R.createElement("button", {
      type: "button",
      className: `${included ? "text-success" : "text-muted"} btn btn-secondary`,
      onClick,
    },
      R.createElement(FaIcon, {
        viewBox: included ? "0 0 448 512" : "0 0 384 512",
        d: included ? FA_CHECK : FA_XMARK,
      })
    );
  }

  // Single field row — matches PerformerModal.tsx maybeRenderField /
  // maybeRenderURLListField exactly.
  function FieldRow({ def, scraped, checked, onToggle }) {
    const R = PluginApi.React;

    // URL list variant
    if (def.urlList) {
      const urls = scraped.urls;
      if (!Array.isArray(urls) || !urls.length) return null;

      return R.createElement("div", { className: "row no-gutters" },
        R.createElement("div", { className: "col-5 create-modal-field" },
          R.createElement(ToggleButton, { included: checked, onClick: onToggle }),
          R.createElement("strong", null, `${def.label}:`)
        ),
        R.createElement("div", { className: "col-7 create-modal-value" },
          R.createElement("ul", null,
            urls.map((url, i) =>
              R.createElement("li", { key: i },
                R.createElement("a", {
                  href: url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                },
                  R.createElement("div", {
                    className: "TruncatedText",
                    style: { WebkitLineClamp: 1 },
                  }, url)
                )
              )
            )
          )
        )
      );
    }

    // Skip conditionally hidden fields (e.g. fake_tits for male performers)
    if (def.skipIf && def.skipIf(scraped)) return null;

    const sv = displayVal(def, scrapedVal(def, scraped));
    if (!sv) return null;

    // Non-truncated variant (tattoos, piercings) — <span> instead of TruncatedText
    if (def.noTruncate) {
      return R.createElement("div", { className: "row no-gutters" },
        R.createElement("div", { className: "col-5 create-modal-field" },
          R.createElement(ToggleButton, { included: checked, onClick: onToggle }),
          R.createElement("strong", null, `${def.label}:`)
        ),
        R.createElement("span", { className: "col-7 create-modal-value" }, sv)
      );
    }

    // Standard TruncatedText variant
    return R.createElement("div", { className: "row no-gutters" },
      R.createElement("div", { className: "col-5 create-modal-field" },
        R.createElement(ToggleButton, { included: checked, onClick: onToggle }),
        R.createElement("strong", null, `${def.label}:`)
      ),
      R.createElement("div", { className: "col-7 create-modal-value" },
        R.createElement("div", {
          className: "TruncatedText",
          style: { WebkitLineClamp: 1 },
        }, sv)
      )
    );
  }

  // "Update Performer" modal — replicates the tagger's PerformerModal layout.
  function UpdatePerformerModal({ perf, scraped, onClose, onSaved }) {
    const R = PluginApi.React;
    const [checked,  setChecked]  = R.useState(() => initChecked(perf, scraped));
    const [imgIdx,   setImgIdx]   = R.useState(0);
    const [useImage, setUseImage] = R.useState(!!(scraped.images?.length));
    const [saving,   setSaving]   = R.useState(false);
    const [error,    setError]    = R.useState(null);

    const images = scraped.images ?? [];

    function toggle(key) {
      setChecked(prev => ({ ...prev, [key]: !prev[key] }));
    }

    async function handleSave() {
      setSaving(true);
      setError(null);
      try {
        await saveUpdate(buildInput(perf, scraped, checked, useImage, imgIdx));
        onSaved();
      } catch (e) {
        setError(e.message);
        setSaving(false);
      }
    }

    return R.createElement(R.Fragment, null,

      // Backdrop
      R.createElement("div", { className: "modal-backdrop show" }),

      // Modal — clicking the dimmed area outside the dialog closes it
      R.createElement("div", {
        role: "dialog",
        "aria-modal": "true",
        className: "ModalComponent modal show",
        style: { display: "block" },
        tabIndex: -1,
        onClick: e => { if (e.target === e.currentTarget) onClose(); },
      },
        R.createElement("div", { className: "modal-dialog performer-create-modal" },
          R.createElement("div", { className: "modal-content" },

            // ── Header ──
            R.createElement("div", { className: "modal-header" },
              R.createElement(FaIcon, { viewBox: "0 0 576 512", d: FA_TAGS }),
              R.createElement("span", null, " Update Performer")
            ),

            // ── Body ──
            R.createElement("div", { className: "modal-body" },
              R.createElement("div", { className: "row" },

                // Left column — field rows (col-7 with images, col-12 without)
                R.createElement("div", { className: images.length ? "col-7" : "col-12" },
                  FIELD_DEFS.map(def => R.createElement(FieldRow, {
                    key: def.key, def, scraped,
                    checked: !!checked[def.key],
                    onToggle: () => toggle(def.key),
                  })),
                  error && R.createElement("div", { className: "text-danger mt-2 small" }, error)
                ),

                // Right column — image selection (only when images available)
                images.length > 0 && R.createElement("div", { className: "col-5 image-selection" },
                  R.createElement("div", { className: "performer-image" },
                    R.createElement("button", {
                      type: "button",
                      className: `performer-image-exclude ${useImage ? "text-success" : "text-muted"} btn btn-secondary`,
                      title: useImage ? "Exclude image" : "Include image",
                      onClick: () => setUseImage(p => !p),
                    },
                      R.createElement(FaIcon, {
                        viewBox: useImage ? "0 0 448 512" : "0 0 384 512",
                        d: useImage ? FA_CHECK : FA_XMARK,
                      })
                    ),
                    R.createElement("img", {
                      key: imgIdx,
                      src: images[imgIdx],
                      alt: "",
                      onError: e => { e.currentTarget.style.opacity = "0.3"; },
                    })
                  ),
                  R.createElement("div", { className: "d-flex mt-3" },
                    R.createElement("button", {
                      type: "button",
                      className: "btn btn-primary",
                      disabled: images.length <= 1,
                      onClick: () => setImgIdx(i => (i - 1 + images.length) % images.length),
                    }, R.createElement(FaIcon, { viewBox: "0 0 512 512", d: FA_ARROW_LEFT })),
                    R.createElement("h5", { className: "flex-grow-1" },
                      "Select performer image",
                      R.createElement("br", null),
                      `${imgIdx + 1} of ${images.length}`
                    ),
                    R.createElement("button", {
                      type: "button",
                      className: "btn btn-primary",
                      disabled: images.length <= 1,
                      onClick: () => setImgIdx(i => (i + 1) % images.length),
                    }, R.createElement(FaIcon, { viewBox: "0 0 512 512", d: FA_ARROW_RIGHT }))
                  )
                )
              )
            ),

            // ── Footer ──
            R.createElement("div", { className: "ModalFooter modal-footer" },
              R.createElement("div", null),
              R.createElement("div", null,
                R.createElement("button", {
                  type: "button",
                  className: "ml-2 btn btn-secondary",
                  onClick: onClose,
                }, "Cancel"),
                R.createElement("button", {
                  type: "button",
                  className: "ml-2 btn btn-primary",
                  disabled: saving,
                  onClick: handleSave,
                },
                  saving
                    ? R.createElement(R.Fragment, null,
                        R.createElement("span", {
                          className: `${PLUGIN_ID}-spinner`,
                          "aria-hidden": "true",
                        }),
                        " Saving…"
                      )
                    : "Save"
                )
              )
            )

          )
        )
      )
    );
  }

  // ── Mount / unmount ───────────────────────────────────────────────────

  function openModal(perf, scraped) {
    const R  = PluginApi.React;
    const RD = PluginApi.ReactDOM;
    if (!R || !RD) { showToast("PluginApi.ReactDOM unavailable", "error"); return; }

    document.body.classList.add("modal-open");
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root = null;

    const unmount = () => setTimeout(() => {
      root ? root.unmount() : RD.unmountComponentAtNode?.(container);
      container.remove();
      document.body.classList.remove("modal-open");
    }, 0);

    const el = R.createElement(UpdatePerformerModal, {
      perf, scraped, onClose: unmount,
      onSaved() {
        unmount();
        showToast(`${perf.name} updated`, "success");
        setTimeout(() => window.location.reload(), 1200);
      },
    });

    if (RD.createRoot) {
      root = RD.createRoot(container);
      root.render(el);
    } else {
      RD.render(el, container);
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────

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
    setTimeout(() => el.classList.add(`${PLUGIN_ID}-toast--out`), 2800);
    setTimeout(() => el.remove(), 3100);
  }

  // ── Refresh button ────────────────────────────────────────────────────

  function refreshSVG(size = 14) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
    </svg>`;
  }

  function makeButton(performerId, remoteStashId, endpoint, endpointName) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn minimal ${PLUGIN_ID}-refresh-btn`;
    btn.setAttribute(ATTR, endpoint);
    btn.title = `Update from ${endpointName}`;
    btn.innerHTML = refreshSVG();

    btn.addEventListener("click", async e => {
      e.preventDefault();
      e.stopPropagation();
      btn.disabled = true;
      btn.innerHTML = `<span class="${PLUGIN_ID}-spinner" aria-hidden="true"></span>`;
      try {
        const [perf, scraped] = await Promise.all([
          fetchPerformer(performerId),
          fetchScraped(remoteStashId, endpoint),
        ]);
        if (!scraped) { showToast("No data returned from endpoint", "error"); return; }
        openModal(perf, scraped);
      } catch (err) {
        showToast(`Error: ${err.message}`, "error");
      } finally {
        btn.disabled = false;
        btn.innerHTML = refreshSVG();
      }
    });

    return btn;
  }

  // ── Inject buttons into .stash-id-pill elements ───────────────────────

  async function injectButtons() {
    const m = window.location.pathname.match(/^\/performers\/(\d+)/);
    if (!m) return;
    const performerId = m[1];

    const pills = document.querySelectorAll(".stash-id-pill");
    if (!pills.length) return;
    if (document.querySelector(`[${ATTR}]`)) return; // already injected

    let basic, stashBoxes;
    try {
      [basic, stashBoxes] = await Promise.all([
        fetchPerformerBasic(performerId),
        fetchStashBoxes(),
      ]);
    } catch (err) {
      console.error(`[${PLUGIN_ID}]`, err);
      return;
    }
    if (!basic?.stash_ids?.length) return;

    const boxByEndpoint   = Object.fromEntries(stashBoxes.map(b => [b.endpoint, b.name]));
    const stashByEndpoint = Object.fromEntries(basic.stash_ids.map(s => [s.endpoint, s]));

    pills.forEach(pill => {
      let endpoint = null;
      const link = pill.querySelector("a");

      // 1. data-endpoint attribute contains the box name (most direct).
      const dataName = pill.dataset?.endpoint;
      if (dataName) {
        for (const [ep, name] of Object.entries(boxByEndpoint)) {
          if (name === dataName) { endpoint = ep; break; }
        }
      }

      // 2. Link href contains the performer's stash UUID (very reliable).
      if (!endpoint && link) {
        for (const [ep, entry] of Object.entries(stashByEndpoint)) {
          if (link.href.includes(entry.stash_id)) { endpoint = ep; break; }
        }
      }

      // 3. Link href starts with the endpoint base URL (broadest fallback).
      if (!endpoint && link) {
        for (const ep of Object.keys(stashByEndpoint)) {
          if (link.href.startsWith(ep.replace(/\/graphql$/, ""))) { endpoint = ep; break; }
        }
      }

      if (!endpoint || !stashByEndpoint[endpoint]) return;

      const name = boxByEndpoint[endpoint] ?? endpoint;
      const btn  = makeButton(performerId, stashByEndpoint[endpoint].stash_id, endpoint, name);

      // Insert after the clipboard copy button when present, otherwise after the pill.
      const copyBtn =
        pill.querySelector('button[title*="opy"], button[aria-label*="opy"]') ||
        (pill.nextElementSibling?.tagName === "BUTTON" ? pill.nextElementSibling : null);
      (copyBtn ?? pill).insertAdjacentElement("afterend", btn);
    });
  }

  // ── Navigation detection ──────────────────────────────────────────────

  let observer = null, lastPath = "", injecting = false;

  async function safeInject() {
    if (injecting) return;
    injecting = true;
    try { await injectButtons(); } finally { injecting = false; }
    if (document.querySelector(`[${ATTR}]`)) { observer?.disconnect(); observer = null; }
  }

  function onNavigate() {
    const path = window.location.pathname;
    if (path === lastPath) return;
    lastPath = path;
    injecting = false;
    observer?.disconnect();
    observer = null;

    if (!/^\/performers\/\d+/.test(path)) return;

    observer = new MutationObserver(() => {
      if (document.querySelector(".stash-id-pill")) safeInject();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    safeInject();
  }

  function init() {
    PluginApi.Event.addEventListener("stash:location", onNavigate);
    onNavigate();
  }

  const ready = setInterval(() => {
    if (window.PluginApi?.Event) { clearInterval(ready); init(); }
  }, 50);
})();

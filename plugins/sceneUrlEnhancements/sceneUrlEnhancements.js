(function () {
  "use strict";

  const PLUGIN_ID = "sceneUrlEnhancements";
  const LOG_PREFIX = "[SceneUrlEnhancements]";
  const OPEN_BTN_CLASS = "open-url-new-tab-button";
  const DETAILS_URLS_CLASS = "scene-url-enhancements-details-urls";

  // Standard FontAwesome "arrow-up-right-from-square" (external link) glyph,
  // inlined so it doesn't depend on whichever icon subset Stash bundles.
  // Stash's own ".fa-icon" class (used for non-FA svgs elsewhere in the app,
  // e.g. the O-counter icon) gives it the same sizing as the real FA icons.
  const OPEN_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" ' +
    'width="1em" height="1em" preserveAspectRatio="xMidYMid meet" viewBox="0 0 512 512" class="fa-icon">' +
    '<path fill="currentColor" d="M384 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l50.7 0L242.7 290.7c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L480 141.3l0 50.7c0 17.7 14.3 32 32 32s32-14.3 32-32l0-128c0-17.7-14.3-32-32-32L384 32zM80 32C35.8 32 0 67.8 0 112L0 432c0 44.2 35.8 80 80 80l320 0c44.2 0 80-35.8 80-80l0-112c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 112c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-320c0-8.8 7.2-16 16-16l112 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 32z"/></svg>';

  let settings = { moveUrlsToDetailsTab: false };

  function addOpenButtons(root) {
    const groups = root.querySelectorAll('div[data-field="urls"] .input-group');
    groups.forEach((group) => {
      const input = group.querySelector("input");
      if (!input) return;

      let btn = group.querySelector(`.${OPEN_BTN_CLASS}`);
      if (!btn) {
        const append = group.querySelector(".input-group-append");
        const scrapeBtn = group.querySelector(".scrape-url-button");
        if (!append) return;

        btn = document.createElement("button");
        btn.type = "button";
        btn.title = "Open URL in new tab";
        btn.className = `btn btn-secondary text-input ${OPEN_BTN_CLASS}`;
        btn.innerHTML = OPEN_ICON_SVG;
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          if (input.value) window.open(input.value, "_blank", "noopener,noreferrer");
        });
        input.addEventListener("input", () => {
          btn.disabled = !input.value;
        });

        if (scrapeBtn) {
          append.insertBefore(btn, scrapeBtn);
        } else {
          append.insertBefore(btn, append.firstChild);
        }
      }

      btn.disabled = !input.value;
    });
  }

  // Bootstrap's col-lg-12 (urls) vs col-sm-9 (title/code/date/...) don't
  // resolve to a fixed pixel ratio - row gutter/negative-margin interactions
  // make a static CSS percentage unreliable, and Stash's sidebar itself
  // switches between a narrow fixed-width column and a much wider mobile-ish
  // layout at multiple pixel thresholds, which changes whether Title's
  // label/input sit side-by-side or stacked.
  //
  // Matching pixel widths alone (so the *sum* fits/doesn't fit the row,
  // same as Title) is rounding-sensitive: right at Title's own wrap
  // boundary, a <1px discretization difference between Title's true
  // sub-pixel layout and our rounded copy can pick the opposite mode. So
  // detect Title's mode directly (are label and input on the same line?)
  // and force URLs into the same mode explicitly via flex-wrap, then only
  // use pixel-matching to size *within* that mode.
  function fixUrlsWidth(root) {
    const urlsRow = root.querySelector('div[data-field="urls"]');
    const urlsLabel = root.querySelector('div[data-field="urls"] > label');
    const urlsContent = root.querySelector('div[data-field="urls"] > div');
    const titleField =
      root.querySelector('div[data-field="title"] > label') ? root.querySelector('div[data-field="title"]') : root.querySelector('div[data-field="code"]');
    const titleLabel = titleField && titleField.querySelector("label");
    const titleInput = titleField && titleField.querySelector("input");
    if (!urlsRow || !urlsLabel || !urlsContent || !titleLabel || !titleInput) return;

    const titleLabelRect = titleLabel.getBoundingClientRect();
    const titleInputRect = titleInput.getBoundingClientRect();
    const stacked = Math.round(titleInputRect.top) !== Math.round(titleLabelRect.top);

    // Math.floor, not round: rounding *up* even by a fraction of a pixel
    // could make a width slightly exceed what Title actually measured,
    // causing visible overflow once flex-wrap is forced off below.
    // Flooring only ever undershoots by <1px (never visible).
    const labelWidth = Math.floor(titleLabelRect.width);
    // urlsContent (col-lg-12/col-md-9) has its own left+right padding, same
    // as Title's col-sm-9 wrapper does - but we're measuring Title's *input*
    // (inside that padding), so add it back to get the input-group itself
    // (inside urlsContent's own padding) to land on the same width.
    const contentPadding =
      parseFloat(getComputedStyle(urlsContent).paddingLeft) +
      parseFloat(getComputedStyle(urlsContent).paddingRight);
    let contentWidth = Math.floor(titleInputRect.width + contentPadding);
    if (labelWidth <= 0 || contentWidth <= 0) return;

    // Stash's own sidebar/video divider handle overlaps the trailing ~19px
    // of any field that reaches the sidebar's right edge - true for Title
    // too, just invisible there since it's not a brightly-colored button.
    // Keep URLs' buttons clear of it explicitly.
    const divider = document.querySelector(".scene-divider");
    if (divider) {
      const dividerLeft = divider.getBoundingClientRect().left;
      const contentLeft = urlsContent.getBoundingClientRect().left;
      const safeWidth = Math.floor(dividerLeft - contentLeft - 4);
      if (safeWidth > 0) contentWidth = Math.min(contentWidth, safeWidth);
    }

    const marker = `${stacked}|${labelWidth}x${contentWidth}`;
    if (urlsRow.dataset.matched === marker) return;

    urlsRow.style.flexWrap = stacked ? "wrap" : "nowrap";
    if (stacked) {
      // Stacked: let the label keep its native full-row width (col-lg-12) -
      // only the content/input-group width needs matching.
      urlsLabel.style.flex = "";
      urlsLabel.style.maxWidth = "";
    } else {
      urlsLabel.style.flex = `0 0 ${labelWidth}px`;
      urlsLabel.style.maxWidth = `${labelWidth}px`;
    }
    urlsContent.style.flex = `0 0 ${contentWidth}px`;
    urlsContent.style.maxWidth = `${contentWidth}px`;
    urlsRow.dataset.matched = marker;
  }

  function findUrlsDt(root) {
    const dts = root.querySelectorAll(".file-info-panel dt");
    for (const dt of dts) {
      if (dt.textContent.trim() === "URLs:") return dt;
    }
    return null;
  }

  function findTagsHeading(detailsPanel) {
    const headings = detailsPanel.querySelectorAll("h6");
    for (const h of headings) {
      const t = h.textContent.trim();
      if (t === "Tag" || t === "Tags") return h;
    }
    return null;
  }

  function insertDetailsUrlBlock(detailsPanel, urlsDd) {
    const wrapper = document.createElement("div");
    wrapper.className = DETAILS_URLS_CLASS;
    // Target a 14px gap above "URLs", matching the gap between the Details
    // paragraph and the Tags heading. Tag badges are inline-block, so their
    // own 5px margin-bottom *adds to* (rather than collapses with) our
    // margin-top - so we only need to add the remaining 9px on top of that.
    wrapper.style.marginTop = "9px";
    const heading = document.createElement("h6");
    heading.textContent = "URLs";
    wrapper.appendChild(heading);
    wrapper.appendChild(urlsDd.cloneNode(true));

    const tagHeading = findTagsHeading(detailsPanel);
    if (tagHeading) {
      let after = tagHeading;
      while (after.nextElementSibling && after.nextElementSibling.tagName !== "H6") {
        after = after.nextElementSibling;
      }
      after.parentElement.insertBefore(wrapper, after.nextElementSibling);
      return;
    }

    // No tags section to anchor on - fall back to the row below
    // Created At/Updated At (always present, even if currently empty).
    const detailsAnchor = detailsPanel.querySelector(".scene-details");
    const fallbackRow = detailsAnchor && detailsAnchor.closest(".row").nextElementSibling;
    const fallbackTarget = (fallbackRow && fallbackRow.querySelector(".col-12")) || detailsPanel;
    fallbackTarget.appendChild(wrapper);
  }

  function relocateUrls(root) {
    const urlsDt = findUrlsDt(root);

    if (!settings.moveUrlsToDetailsTab) {
      if (urlsDt) {
        urlsDt.style.display = "";
        if (urlsDt.nextElementSibling) urlsDt.nextElementSibling.style.display = "";
      }
      root.querySelectorAll(`.${DETAILS_URLS_CLASS}`).forEach((el) => el.remove());
      return;
    }

    if (!urlsDt) return;
    const urlsDd = urlsDt.nextElementSibling;
    if (!urlsDd) return;

    const detailsAnchor = root.querySelector(".scene-details");
    const detailsPanel = detailsAnchor && detailsAnchor.closest('[role="tabpanel"]');
    if (!detailsPanel) return;

    // Skip the (somewhat expensive) remove+recreate once we're already in sync -
    // this runs on every DOM mutation on the page (e.g. video playback ticks),
    // so it needs a cheap no-op path.
    const existing = detailsPanel.querySelector(`.${DETAILS_URLS_CLASS}`);
    const desired = urlsDd.innerHTML;
    if (existing && existing.dataset.sourceHtml === desired) {
      urlsDt.style.display = "none";
      urlsDd.style.display = "none";
      return;
    }

    if (existing) existing.remove();
    insertDetailsUrlBlock(detailsPanel, urlsDd);
    detailsPanel.querySelector(`.${DETAILS_URLS_CLASS}`).dataset.sourceHtml = desired;

    urlsDt.style.display = "none";
    urlsDd.style.display = "none";
  }

  function process() {
    if (!document.querySelector('div[data-field="urls"], .file-info-panel dt')) return;
    addOpenButtons(document);
    fixUrlsWidth(document);
    relocateUrls(document);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      try {
        process();
      } catch (e) {
        console.error(LOG_PREFIX, "failed to process scene page", e);
      }
    }, 50);
  }

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("resize", () => {
    // the matched marker is keyed off the old target widths, so a plain
    // schedule() would no-op; force a recheck by clearing it first.
    document.querySelectorAll('div[data-field="urls"]').forEach((el) => {
      delete el.dataset.matched;
    });
    schedule();
  });

  async function loadSettings() {
    try {
      const res = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operationName: "SceneUrlEnhancementsSettings",
          query: "query SceneUrlEnhancementsSettings { configuration { plugins } }",
        }),
      });
      const json = await res.json();
      const saved = (json && json.data && json.data.configuration.plugins[PLUGIN_ID]) || {};
      settings = { moveUrlsToDetailsTab: !!saved.moveUrlsToDetailsTab };
    } catch (e) {
      console.error(LOG_PREFIX, "failed to load plugin settings, using defaults", e);
    } finally {
      schedule();
    }
  }

  loadSettings();
})();

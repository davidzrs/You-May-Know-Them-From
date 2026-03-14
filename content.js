// Main entry point for the extension
function startExtension() {
  const FLAG_NAME = "ymktfromHasRun";

  if (window[FLAG_NAME]) {
    console.log("Extension already running. Skipping reload.");
    return;
  }

  window[FLAG_NAME] = true;
  console.log("You May Know Them From: script started!");

  function mountUI() {
    let root = document.querySelector("#ymktf-root");
    if (root) return root;

    root = document.createElement("div");
    root.id = "ymktf-root";

    root.innerHTML = `
      <div id="ymktf-card" class="ymktf-card">
        <div class="ymktf-card__top">
          <div>
            <div id="ymktf-heading" class="ymktf-heading">You may know them from</div>
            <div id="ymktf-subtitle" class="ymktf-subtitle">Loading…</div>
          </div>
          <button id="ymktf-show-more" class="ymktf-button" hidden>Show more</button>
        </div>
      </div>

      <div id="ymktf-modal-backdrop" class="ymktf-modal-backdrop" hidden>
        <div id="ymktf-modal" class="ymktf-modal" role="dialog" aria-modal="true" aria-label="Matched titles">
          <div class="ymktf-modal__header">
            <div>
              <div class="ymktf-modal__title">You may know them from</div>
              <div id="ymktf-modal-subtitle" class="ymktf-modal__subtitle"></div>
            </div>
            <button id="ymktf-close-modal" class="ymktf-close-button" aria-label="Close">×</button>
          </div>

          <div id="ymktf-modal-grid" class="ymktf-modal-grid"></div>
        </div>
      </div>
    `;

    document.documentElement.appendChild(root);

    const card = root.querySelector("#ymktf-card");
    const showMoreButton = root.querySelector("#ymktf-show-more");
    const backdrop = root.querySelector("#ymktf-modal-backdrop");
    const closeButton = root.querySelector("#ymktf-close-modal");

    function reserveSpaceForBanner() {
      const bannerHeight = card.offsetHeight;

      // put enough space at the top of the page so the banner does not cover content
      document.body.style.paddingTop = `${bannerHeight + 18}px`;
    }

    // reserve space now
    requestAnimationFrame(reserveSpaceForBanner);

    // reserve space again when window resizes
    window.addEventListener("resize", reserveSpaceForBanner);

    showMoreButton.addEventListener("click", () => {
      backdrop.hidden = false;
      document.body.style.overflow = "hidden";
    });

    closeButton.addEventListener("click", () => {
      backdrop.hidden = true;
      document.body.style.overflow = "";
    });

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) {
        backdrop.hidden = true;
        document.body.style.overflow = "";
      }
    });

    return root;
  }


  const uiRoot = mountUI();

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  function findHeading(text) {
    const t = text.toLowerCase();
    for (const h of document.querySelectorAll("h1,h2,h3,h4,h5,h6")) {
      if ((h.textContent || "").trim().toLowerCase().includes(t)) {
        return h;
      }
    }
    return null;
  }

  function idFromHref(href) {
    const match = href.match(/^\/(\d+)-/);
    if (match) {
      return match[1];
    }
    return undefined;
  }

  function titlesFromTableAfter(headingText) {
    const heading = findHeading(headingText);
    if (!heading) {
      console.log(`[YMKTF] Heading "${headingText}" not found`);
      return [];
    }

    let table = heading.nextElementSibling;
    while (table && table.tagName !== "TABLE") {
      table = table.nextElementSibling;
    }

    if (!table || table.tagName !== "TABLE") {
      console.log(`[YMKTF] No table found after "${headingText}" heading`);
      return [];
    }

    const links = [...table.querySelectorAll('a[href^="/"]')];
    const seen = new Map();

    for (const a of links) {
      const href = a.getAttribute("href") || "";
      const id = idFromHref(href);
      const name = (a.textContent || "").trim();

      if (id && name && !seen.has(id)) {
        seen.set(id, {
          id,
          name,
          url: `https://mydramalist.com${href}`
        });
      }
    }

    return [...seen.values()];
  }

  function prettyStatus(status) {
    if (!status) return "";
    if (status === "on_hold") return "On Hold";
    if (status === "watching") return "Watching";
    if (status === "completed") return "Completed";
    if (status === "dropped") return "Dropped";
    return status;
  }

  function buildMatchedTitleData(matches, syncedTitles) {
    return matches.map(match => {
      const stored = syncedTitles[match.id] || {};

      return {
        id: match.id,
        name: stored.name || match.name,
        url: stored.url || match.url,
        poster: stored.poster || "",
        status: stored.status || ""
      };
    });
  }

  function renderSummary(matchedTitles) {
    const headingEl = uiRoot.querySelector("#ymktf-heading");
    const subtitleEl = uiRoot.querySelector("#ymktf-subtitle");
    const showMoreButton = uiRoot.querySelector("#ymktf-show-more");

    if (matchedTitles.length === 0) {
      headingEl.textContent = "You may know them from";
      subtitleEl.textContent = "No matches found yet.";
      showMoreButton.hidden = true;
      return;
    }

    headingEl.textContent = `You may know them from ${matchedTitles.length} title${matchedTitles.length === 1 ? "" : "s"}`;

    const previewNames = matchedTitles.slice(0, 3).map(item => item.name);
    let previewText = previewNames.join(", ");

    if (matchedTitles.length > 3) {
      previewText += ` +${matchedTitles.length - 3} more`;
    }

    subtitleEl.textContent = previewText;
    showMoreButton.hidden = matchedTitles.length === 0;
  }

  function renderModal(matchedTitles) {
    const modalSubtitle = uiRoot.querySelector("#ymktf-modal-subtitle");
    const modalGrid = uiRoot.querySelector("#ymktf-modal-grid");

    modalSubtitle.textContent = `${matchedTitles.length} matched title${matchedTitles.length === 1 ? "" : "s"}`;
    modalGrid.innerHTML = "";

    for (const item of matchedTitles) {
      const card = document.createElement("a");
      card.className = "ymktf-title-card";
      card.href = item.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";

      const posterHtml = item.poster
        ? `<img class="ymktf-title-card__poster" src="${item.poster}" alt="${item.name} poster">`
        : `<div class="ymktf-title-card__poster-placeholder">No poster</div>`;

      card.innerHTML = `
        <div class="ymktf-title-card__media">
          ${posterHtml}
        </div>
        <div class="ymktf-title-card__body">
          <div class="ymktf-title-card__name">${item.name}</div>
          <div class="ymktf-title-card__meta">${prettyStatus(item.status)}</div>
        </div>
      `;

      modalGrid.appendChild(card);
    }
  }

  // ------------------------------------------------------------
  // Gather actor titles from the page
  // ------------------------------------------------------------
  const dramaTitles = titlesFromTableAfter("Drama");
  const movieTitles = titlesFromTableAfter("Movie");
  const actorTitles = [...dramaTitles, ...movieTitles];

  console.log("[YMKTF] Drama titles found:", dramaTitles);
  console.log("[YMKTF] Movie titles found:", movieTitles);
  console.log("[YMKTF] All actor titles:", actorTitles);

  // ------------------------------------------------------------
  // Read synced user data and render matches
  // ------------------------------------------------------------
  chrome.storage.local.get(["syncedIds", "syncedTitles"], (result) => {
    const syncedIds = result.syncedIds || [];
    const syncedTitles = result.syncedTitles || {};
    const watchedSet = new Set(syncedIds);

    console.log("[YMKTF] Synced IDs from storage:", syncedIds);
    console.log("[YMKTF] Synced title metadata:", syncedTitles);

    const matches = actorTitles.filter(t => watchedSet.has(t.id));
    console.log("[YMKTF] Matches found:", matches);

    const matchedTitles = buildMatchedTitleData(matches, syncedTitles);

    renderSummary(matchedTitles);
    renderModal(matchedTitles);
  });
}

startExtension();

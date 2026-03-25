function startExtension() {
  const FLAG_NAME = "ymktfromHasRun";

  if (window[FLAG_NAME]) {
    console.log("Extension already running. Skipping reload.");
    return;
  }

  const path = window.location.pathname;
  const isMainPeoplePage = /^\/people\/\d+-[^/]+$/.test(path);

  if (!isMainPeoplePage) {
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
      document.body.style.paddingTop = `${bannerHeight + 18}px`;
    }

    requestAnimationFrame(reserveSpaceForBanner);
    window.addEventListener("resize", reserveSpaceForBanner);

    showMoreButton.addEventListener("click", () => {
      renderModal(currentMatchedTitles);

      backdrop.hidden = false;
      document.body.style.overflow = "hidden";
      storageSet({ posterCacheOrder });

      enhanceModalPosters(currentMatchedTitles);
    });

    closeButton.addEventListener("click", () => {
      backdrop.hidden = true;
      document.body.style.overflow = "";
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !backdrop.hidden) {
        backdrop.hidden = true;
        document.body.style.overflow = "";
      }
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

  const storageSet = (obj) =>
    new Promise((resolve) => chrome.storage.local.set(obj, resolve));

  let currentMatchedTitles = [];
  let posterCache = {};
  let posterCacheOrder = [];

  const MAX_POSTER_CACHE_SIZE = 150;

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

    const rows = [...table.querySelectorAll("tr")];
    const seen = new Map();

    const actingSections = new Set([
      "Drama",
      "Movie",
      "TV Show",
      "Special"
    ]);

    const staffSections = new Set([
      "Director",
      "Screenwriter",
      "Writer",
      "Original Creator",
      "Executive Producer",
      "Composer",
      "Music Director",
      "Cinematography"
    ]);

    for (const row of rows) {
      const titleLink = row.querySelector('a[href^="/"]');
      if (!titleLink) {
        continue;
      }

      const href = titleLink.getAttribute("href") || "";
      const id = idFromHref(href);
      const name = (titleLink.textContent || "").trim();

      if (!id || !name || seen.has(id)) {
        continue;
      }

      let creditLabel = "";

      if (actingSections.has(headingText)) {
        const rowText = row.textContent || "";

        if (rowText.includes("Main Role")) {
          creditLabel = "Main Role";
        } else if (rowText.includes("Support Role")) {
          creditLabel = "Support Role";
        } else if (rowText.includes("Guest Role")) {
          creditLabel = "Guest Role";
        } else if (rowText.includes("Main Host")) {
          creditLabel = "Main Host";
        } else if (rowText.includes("Regular Member")) {
          creditLabel = "Regular Member";
        } else if (rowText.includes("Bit Part")) {
          creditLabel = "Bit Part";
        } else if (rowText.includes("Cameo")) {
          creditLabel = "Cameo";
        } else if (rowText.includes("Guest")) {
          creditLabel = "Guest";
        }
      } else if (staffSections.has(headingText)) {
        creditLabel = headingText;
      }

      seen.set(id, {
        id,
        name,
        url: `https://mydramalist.com${href}`,
        creditLabel
      });
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

  function buildMetaLines(item) {
    const lines = [];

    const statusText = prettyStatus(item.status);
    if (statusText) {
      lines.push({
        text: statusText,
        type: "status"
      });
    }

    if (item.creditLabel) {
      lines.push({
        text: item.creditLabel,
        type: "credit"
      });
    }

    return lines;
  }

  function buildMatchedTitleData(matches, syncedTitles) {
    return matches.map(match => {
      const stored = syncedTitles[match.id] || {};

      return {
        id: match.id,
        name: stored.name || match.name,
        url: stored.url || match.url,
        poster: stored.poster || "",
        status: stored.status || "",
        creditLabel: match.creditLabel || ""
      };
    });
  }

  function touchPosterCacheKey(titleId) {
    posterCacheOrder = posterCacheOrder.filter(id => id !== titleId);

    posterCacheOrder.push(titleId);
  }

  function trimPosterCacheIfNeeded() {
    while (posterCacheOrder.length > MAX_POSTER_CACHE_SIZE) {
      const oldestId = posterCacheOrder.shift();
      if (oldestId) {
        delete posterCache[oldestId];
      }
    }
  }

  async function savePosterToCache(titleId, posterUrl) {
    posterCache[titleId] = posterUrl;
    touchPosterCacheKey(titleId);
    trimPosterCacheIfNeeded();

    await storageSet({
      posterCache,
      posterCacheOrder
    });
  }

  function escapeHtml(text) {
    return String(text)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function updateModalPoster(titleId, posterUrl) {
    const img = uiRoot.querySelector(`img[data-title-id="${titleId}"]`);
    const placeholder = uiRoot.querySelector(`[data-placeholder-id="${titleId}"]`);

    if (img) {
      img.src = posterUrl;
      return;
    }

    if (placeholder) {
      const newImg = document.createElement("img");
      newImg.className = "ymktf-title-card__poster";
      newImg.setAttribute("data-title-id", titleId);
      newImg.alt = "Poster";
      newImg.src = posterUrl;
      placeholder.replaceWith(newImg);
    }
  }

  async function fetchHQPosterFromTitlePage(titleUrl) {
    try {
      const response = await fetch(titleUrl);
      const html = await response.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      let poster =
        doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
        doc.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
        "";

      if (!poster) {
        const img =
          doc.querySelector(".film-cover img") ||
          doc.querySelector(".box-body img") ||
          doc.querySelector("img");

        if (img) {
          poster =
            img.getAttribute("data-src") ||
            img.getAttribute("data-original") ||
            img.getAttribute("src") ||
            "";
        }
      }

      if (poster && poster.startsWith("/")) {
        poster = `https://mydramalist.com${poster}`;
      }

      return poster || "";
    } catch (error) {
      console.error("[YMKTF] Failed to fetch HQ poster from:", titleUrl, error);
      return "";
    }
  }

  async function enhanceModalPosters(matchedTitles) {
    for (const item of matchedTitles) {
      if (posterCache[item.id]) {
        continue;
      }

      if (!item.url) {
        continue;
      }

      const hqPoster = await fetchHQPosterFromTitlePage(item.url);

      if (!hqPoster) {
        continue;
      }

      await savePosterToCache(item.id, hqPoster);
      updateModalPoster(item.id, hqPoster);
    }
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

      // Prefer HQ cached poster if available (high quality)
      const posterToUse = posterCache[item.id] || item.poster || "";

      if (posterCache[item.id]) {
        touchPosterCacheKey(item.id);
      }

      const posterHtml = posterToUse
        ? `<img class="ymktf-title-card__poster" data-title-id="${escapeHtml(item.id)}" src="${escapeHtml(posterToUse)}" alt="${escapeHtml(item.name)} poster">`
        : `<div class="ymktf-title-card__poster-placeholder" data-placeholder-id="${escapeHtml(item.id)}">No poster</div>`;

      const metaLines = buildMetaLines(item);

      card.innerHTML = `
        <div class="ymktf-title-card__media">
          ${posterHtml}
        </div>
        <div class="ymktf-title-card__body">
          <div class="ymktf-title-card__name">${escapeHtml(item.name)}</div>
          ${metaLines.map(line => `
            <div class="ymktf-title-card__meta ymktf-title-card__meta--${escapeHtml(line.type)}">
              ${escapeHtml(line.text)}
            </div>
          `).join("")}
        </div>
      `;

      modalGrid.appendChild(card);
    }
  }

  // what sections from /people pages do we want to grab? grabbing practically everything although cinematography and composer is prob useless
  const actingSectionNames = [
    "Drama",
    "Movie",
    "TV Show",
    "Special"
  ];

  const staffSectionNames = [
    "Director",
    "Screenwriter",
    "Writer",
    "Original Creator",
    "Executive Producer",
    "Composer",
    "Music Director",
    "Cinematography"
  ];

  chrome.storage.local.get(
    ["syncedIds", "syncedTitles", "posterCache", "posterCacheOrder", "includeStaffCredits"],
    (result) => {
      const syncedIds = result.syncedIds || [];
      const syncedTitles = result.syncedTitles || {};
      posterCache = result.posterCache || {};
      posterCacheOrder = result.posterCacheOrder || [];

      const includeStaffCredits = result.includeStaffCredits !== false;
      const sectionNames = includeStaffCredits
        ? [...actingSectionNames, ...staffSectionNames]
        : [...actingSectionNames];

      const allFoundTitles = sectionNames.flatMap(sectionName =>
        titlesFromTableAfter(sectionName)
      );

      const actorTitleMap = new Map();
      for (const title of allFoundTitles) {
        if (!actorTitleMap.has(title.id)) {
          actorTitleMap.set(title.id, title);
        }
      }

      const actorTitles = [...actorTitleMap.values()];
      const watchedSet = new Set(syncedIds);

      console.log("[YMKTF] Include staff credits:", includeStaffCredits);
      console.log("[YMKTF] Sections checked:", sectionNames);
      console.log("[YMKTF] All actor titles found:", actorTitles);
      console.log("[YMKTF] Actor title IDs:", actorTitles.map(t => t.id));
      console.log("[YMKTF] Synced IDs from storage:", syncedIds);
      console.log("[YMKTF] Synced title metadata:", syncedTitles);
      console.log("[YMKTF] HQ poster cache:", posterCache);

      const matches = actorTitles.filter(t => watchedSet.has(t.id));
      console.log("[YMKTF] Matches found:", matches);

      const matchedTitles = buildMatchedTitleData(matches, syncedTitles);
      currentMatchedTitles = matchedTitles;

      renderSummary(matchedTitles);
      renderModal(matchedTitles);
    }
  );
}

startExtension();

const usernameInput = document.querySelector("#username");
const saveButton = document.querySelector("#saveButton");
const syncButton = document.querySelector("#syncButton");
const statusText = document.querySelector("#status");

// Load saved username when popup opens
chrome.storage.local.get(["mdlUsername"], (result) => {
  if (result.mdlUsername) {
    usernameInput.value = result.mdlUsername;
  }
});

// Save username
saveButton.addEventListener("click", () => {
  const username = usernameInput.value.trim();

  chrome.storage.local.set({ mdlUsername: username }, () => {
    statusText.textContent = "Username saved!";
  });
});

/**
 * Extract the numeric MDL title ID from a relative URL like:
 * /694231-mr-sunshine
 */
function idFromHref(href) {
  const match = href.match(/^\/(\d+)-/);
  if (match) {
    return match[1];
  }
  return undefined;
}

/**
 * Fetch one MDL list page (completed, watching, on_hold, dropped)
 * and return a Map of titles found there.
 *
 * Each entry will look like:
 * id -> {
 *   id,
 *   name,
 *   url,
 *   poster,
 *   status
 * }
 */
async function fetchTitlesFromStatusPage(username, statusName) {
  const url = `https://mydramalist.com/dramalist/${username}/${statusName}`;

  const response = await fetch(url);
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const titles = new Map();

  // Find all links that look like title links
  const links = [...doc.querySelectorAll('a[href^="/"]')];

  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const id = idFromHref(href);

    if (!id) {
      continue;
    }

    const name = (link.textContent || "").trim();
    const fullUrl = `https://mydramalist.com${href}`;

    const container =
      link.closest("tr, .mdl-style-col, .list-item, .box, .card, li") || link.parentElement;

    const img = container ? container.querySelector("img") : null;

    let poster = "";
    if (img) {
      poster =
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("src") ||
        "";
    }


    // DEBUG: only log for the first few matched title links
    if (id === "15999" || id === "23920") {
      console.log("==== DEBUG TITLE ====");
      console.log("name:", name);
      console.log("href:", href);
      console.log("container:", container);
      console.log("container HTML:", container ? container.outerHTML : "NO CONTAINER");
      console.log("img found:", img);
      console.log("poster extracted:", poster);
    }


    // If the poster is a relative path, convert it to a full MDL URL
    if (poster && poster.startsWith("/")) {
      poster = `https://mydramalist.com${poster}`;
    }

    if (!name) {
      continue;
    }

    if (!titles.has(id)) {
      titles.set(id, {
        id,
        name,
        url: fullUrl,
        poster,
        status: statusName
      });
    }
  }

  return titles;
}


syncButton.addEventListener("click", async () => {
  const username = usernameInput.value.trim();

  if (!username) {
    statusText.textContent = "Please enter a username first.";
    return;
  }

  statusText.textContent = "Syncing lists...";

  try {
    const statusesToFetch = [
      "completed",
      "watching",
      "on_hold",
      "dropped"
    ];

    const allTitles = new Map();

    for (const statusName of statusesToFetch) {
      statusText.textContent = `Syncing ${statusName}...`;

      const titlesFromThisStatus = await fetchTitlesFromStatusPage(username, statusName);

      for (const [id, data] of titlesFromThisStatus.entries()) {
        // If already present, keep the first one we found
        if (!allTitles.has(id)) {
          allTitles.set(id, data);
        }
      }
    }

    const syncedTitles = Object.fromEntries(allTitles);
    const syncedIds = Object.keys(syncedTitles);

    chrome.storage.local.set(
      {
        syncedIds,
        syncedTitles
      },
      () => {
        statusText.textContent = `Synced ${syncedIds.length} titles from all lists!`;
      }
    );

  } catch (error) {
    console.error("Error syncing lists:", error);
    statusText.textContent = "Failed to sync lists.";
  }
});

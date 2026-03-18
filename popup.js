const usernameInput = document.querySelector("#username");
const saveButton = document.querySelector("#saveButton");
const syncButton = document.querySelector("#syncButton");
const statusText = document.querySelector("#status");

function setStatus(message) {
  statusText.textContent = message;
}

// Load saved username when popup opens
chrome.storage.local.get(["mdlUsername"], (result) => {
  if (result.mdlUsername) {
    usernameInput.value = result.mdlUsername;
    setStatus("Ready to sync.");
  } else {
    setStatus("Enter your MyDramaList username to begin.");
  }
});

// Save username
saveButton.addEventListener("click", () => {
  const username = usernameInput.value.trim();

  if (!username) {
    setStatus("Please enter a username first.");
    return;
  }

  chrome.storage.local.set({ mdlUsername: username }, () => {
    setStatus("Username saved.");
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
 * Each entry looks like:
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
  const links = [...doc.querySelectorAll('a[href^="/"]')];

  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const id = idFromHref(href);

    if (!id) {
      continue;
    }

    const name = (link.textContent || "").trim();
    if (!name) {
      continue;
    }

    const fullUrl = `https://mydramalist.com${href}`;

    const container =
      link.closest("tr, .mdl-style-col, .list-item, .box, .card, li") ||
      link.parentElement;

    const img = container ? container.querySelector("img") : null;

    let poster = "";
    if (img) {
      poster =
        img.getAttribute("data-src") ||
        img.getAttribute("data-original") ||
        img.getAttribute("src") ||
        "";
    }

    if (poster && poster.startsWith("/")) {
      poster = `https://mydramalist.com${poster}`;
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
    setStatus("Please enter a username first.");
    return;
  }

  setStatus("Syncing lists...");

  try {
    const statusesToFetch = [
      "completed",
      "watching",
      "on_hold",
      "dropped"
    ];

    const allTitles = new Map();

    for (const statusName of statusesToFetch) {
      setStatus(`Fetching ${statusName.replace("_", " ")}...`);

      const titlesFromThisStatus = await fetchTitlesFromStatusPage(username, statusName);

      for (const [id, data] of titlesFromThisStatus.entries()) {
        if (!allTitles.has(id)) {
          allTitles.set(id, data);
        }
      }
    }

    const syncedTitles = Object.fromEntries(allTitles);
    const syncedIds = Object.keys(syncedTitles);

    chrome.storage.local.set(
      {
        mdlUsername: username,
        syncedIds,
        syncedTitles
      },
      () => {
        setStatus(`Synced ${syncedIds.length} titles successfully.`);
      }
    );
  } catch (error) {
    console.error("Error syncing lists:", error);
    setStatus("Failed to sync lists.");
  }
});
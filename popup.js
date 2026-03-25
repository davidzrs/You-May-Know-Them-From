const usernameInput = document.querySelector("#username");
const saveButton = document.querySelector("#saveButton");
const syncButton = document.querySelector("#syncButton");
const statusText = document.querySelector("#status");
const lastSyncedText = document.querySelector("#lastSynced");

function setStatus(message) {
  statusText.textContent = message;
}

function formatLastSynced(timestamp) {
  if (!timestamp) {
    return "Last synced: never";
  }

  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) {
    return "Last synced: just now";
  }

  if (diffMinutes < 60) {
    return `Last synced: ${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  }

  if (diffHours < 24) {
    return `Last synced: ${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  if (diffDays === 1) {
    return "Last synced: yesterday";
  }

  return `Last synced: ${diffDays} days ago`;
}

function setLastSynced(timestamp) {
  lastSyncedText.textContent = formatLastSynced(timestamp);
}

// Load saved username + last sync info when popup opens
chrome.storage.local.get(["mdlUsername", "lastSyncedAt"], (result) => {
  if (result.mdlUsername) {
    usernameInput.value = result.mdlUsername;
    setStatus("Ready to sync.");
  } else {
    setStatus("Enter your MyDramaList username to begin.");
  }

  setLastSynced(result.lastSyncedAt);
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
    const lastSyncedAt = Date.now();

    chrome.storage.local.set(
      {
        mdlUsername: username,
        syncedIds,
        syncedTitles,
        lastSyncedAt
      },
      () => {
        setStatus(`Synced ${syncedIds.length} titles successfully.`);
        setLastSynced(lastSyncedAt);
      }
    );
  } catch (error) {
    console.error("Error syncing lists:", error);
    setStatus("Failed to sync lists.");
  }
});
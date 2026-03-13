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
 * Fetch one MDL status page (completed, watching, etc.)
 * and return a Set of title IDs found there.
 */
async function fetchIdsFromStatusPage(username, statusName) {
  const url = `https://mydramalist.com/dramalist/${username}/${statusName}`;

  const response = await fetch(url);
  const html = await response.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const links = [...doc.querySelectorAll('a[href^="/"]')];

  const ids = new Set();

  for (const link of links) {
    const href = link.getAttribute("href") || "";
    const id = idFromHref(href);

    if (id) {
      ids.add(id);
    }
  }

  return ids;
}

// Sync all watched-ish statuses
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

    const allIds = new Set();

    for (const statusName of statusesToFetch) {
      statusText.textContent = `Syncing ${statusName}...`;

      const idsFromThisStatus = await fetchIdsFromStatusPage(username, statusName);

      for (const id of idsFromThisStatus) {
        allIds.add(id);
      }
    }

    chrome.storage.local.set(
      { syncedIds: [...allIds] },
      () => {
        statusText.textContent = `Synced ${allIds.size} titles from all lists!`;
      }
    );

  } catch (error) {
    console.error("Error syncing lists:", error);
    statusText.textContent = "Failed to sync lists.";
  }
});
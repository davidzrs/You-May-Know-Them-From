// This function is the main entry point for the extension.
// It sets a flag so it runs only once per page.
function startExtension() {
  const FLAG_NAME = "ymktfromHasRun"; // ymktfrom = you may know them from has run

  if (window[FLAG_NAME]) {
    console.log("Extension already running. Skipping reload.");
    return;
  }

  window[FLAG_NAME] = true;
  console.log("You May Know Them From: script started!");

  function mountBanner() {
    let root = document.querySelector("#ymktf");
    if (!root) { 
      root = document.createElement("div"); 
      root.id = "ymktf"; 
      Object.assign(root.style, {
        position: "fixed", 
        top: "56px", 
        left: "0",
        right: "0",
        zIndex: "999999", 
        display: "flex",
        justifyContent: "center", 
        pointerEvents: "none", 
      });


      const inner = document.createElement("div");
      inner.id = "ymktf-inner";
      Object.assign(inner.style, {
        background: "#111", 
        color: "#fff", 
        padding: "10px 14px", 
        font: "16px/1.4 system-ui, sans-serif", 
        borderRadius: "0 0 10px 10px", 
        boxShadow: "0 6px 18px rgba(0,0,0,.18)", 
        pointerEvents: "auto", 
        maxWidth: "980px", 
        width: "fit-content" 
      });
      inner.innerHTML = ` 
        <strong>You may know them from:</strong> 
        <span id="ymktf-list" style="opacity:.85;margin-left:6px">loading…</span>
      `;

      root.appendChild(inner); 
      document.documentElement.appendChild(root); 
    }
  }
  mountBanner();


  function findHeading(text) {
    const t = text.toLowerCase();
    for (const h of document.querySelectorAll("h1,h2,h3,h4,h5,h6")) { 
      if ((h.textContent || "").trim().toLowerCase().includes(t)) {
        return h;
      } 
    }
    return null;
  }

  /**
   * Extracts the numeric drama ID from a MyDramaList link (href).
   *
   * MyDramaList uses links like:
   *   /694231-mr-sunshine
   *   /782622-would-you-marry-me
   * and we only want the numeric ID at the start ("694231", "782622", etc).
   *
   * So this function looks for:
   *   - a forward slash `/` at the beginning
   *   - followed by one or more digits
   *   - followed by a dash `-` (which shows up after the id, starting to say the name of the drama)
   *
   * Examples:
   *   idFromHref("/694231-mr-sunshine") → "694231"
   *   idFromHref("/people/2551-choi-woo-shik") → undefined
   *   idFromHref("/19776-the-package") → "19776"
   *
   * @param {string} href - The URL path to check.
   * @returns {string|undefined} - The extracted ID, or undefined if not found.
   */
  function idFromHref(href) {
    const match = href.match(/^\/(\d+)-/);
    if (match) {
      return match[1];
    }
    return undefined;
  }


  /**
   * Finds all titles (dramas or movies) listed under a given section heading on the MyDramaList page.
   *
   * For example, calling `titlesFromTableAfter("Drama")` will:
   *   1. Find the h5 heading with the text “Drama”.
   *   2. Look for the table that comes right after it.
   *   3. Extract all the drama links (href="/12345-drama-name">...) inside that table.
   *   4. Turn them into an array of objects like:
   *        { id: "12345", name: "Drama Name", url: "https://mydramalist.com/12345-drama-name" }
   *   5. Return that array (without duplicates).
   *
   * Example output:
   * [
   *   { id: "694231", name: "Our Beloved Summer", url: "https://mydramalist.com/694231-us-that-year" },
   *   { id: "782622", name: "Would You Marry Me?", url: "https://mydramalist.com/782622-would-you-marry-me" },
   *   ...
   * ]
   *
   * @param {string} headingText - The section heading to search for ("Drama", "Movie", etc.).
   * @returns {Array<{id: string, name: string, url: string}>} - A list of title objects found under that heading.
   */
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
    
    console.log(`[YMKTF] Found table after "${headingText}":`, table);
    const links = [...table.querySelectorAll('a[href^="/"]')];
    // links will be a list of every link the table has like <a href="/694231-us-that-year">Our Beloved Summer</a>
    console.log(`[YMKTF] Found ${links.length} links in "${headingText}" table`);
    
    const seen = new Map(); 
    for (const a of links) { 
      const href = a.getAttribute("href") || "";
      const id = idFromHref(href);
      const name = (a.textContent || "").trim();
      if (id && name && !seen.has(id)) {
        seen.set(id, { id, name, url: new URL(href, location.origin).href });
      }
    }
    return [...seen.values()]; 
  }

  // gather actor titles (Drama + Movie)
  const dramaTitles = titlesFromTableAfter("Drama");
  const movieTitles = titlesFromTableAfter("Movie");
  const actorTitles = [...dramaTitles, ...movieTitles]; 

  chrome.storage.local.get(["syncedIds"], (result) => {
    const syncedIds = result.syncedIds || [];
    const watchedSet = new Set(syncedIds);

    console.log("[YMKTF] Synced IDs from storage:", syncedIds);

    const matches = actorTitles.filter(t => watchedSet.has(t.id));
    console.log("[YMKTF] Matches found:", matches);

    const listEl = document.querySelector("#ymktf-list");
    if (!listEl) {
      console.error("[YMKTF] Could not find #ymktf-list element!");
      return;
    }

    if (matches.length) {
      listEl.textContent = matches.map(m => m.name).join(", ");
    } else {
      listEl.textContent = "— none yet —";
    }
  });
  
} startExtension();


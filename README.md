# You May Know Them From

A browser extension for MyDramaList that shows which titles from **your own MDL library** you know an actor, director, writer, or other credited person from.

Instead of scrolling through a full filmography and trying to remember where you have seen someone before, the extension surfaces your matching titles right at the top of the page.

## Why this exists

When watching a drama or a movie, there is a very common moment:
> “I know this actor from somewhere... but from where?”

This extension answers that instantly by comparing the person’s credits with the titles saved from your synced MyDramaList library. If you have already logged a drama, movie, or show they appeared in, you will instantly see the match without having to scroll through their entire filmography.

## Features

- Shows a **top banner** on MDL people pages with matched titles from your library
- Displays a **Show more** modal with posters, watch status, and role/credit labels
- Supports not only actors, but also optional **staff credits** (toggleable in settings), such as:
  - Director
  - Screenwriter
  - Writer
  - Original Creator
  - Executive Producer
  - Composer
  - Music Director
  - Cinematography
- Uses **high-resolution posters** inside the modal
- Caches posters locally for faster repeat viewing
- Lets you sync your MDL library directly from the extension popup
- Includes a small settings panel with:
  - toggle for staff credits
  - clear synced data
- Stores everything **locally** in browser storage

## Screenshots

### Banner on a person page
![Banner screenshot](./screenshots/top_banner.png)

### Expanded “Show more” modal
![Modal screenshot](./screenshots/show_more.png)

### Extension popup
![Popup screenshot](./screenshots/popup.png)

## How it works

The extension does two main things:

### 1. Syncs your MyDramaList library
From the popup, you enter your MDL username and sync your watched lists.

Currently, the extension syncs these statuses:
- Completed
- Watching
- On Hold
- Dropped

The synced title data is stored locally in browser storage.

### 2. Matches credits on MDL people pages
When you open a MyDramaList `/people/...` (essentially a person's) page, the extension scans that person’s visible credits and compares them against your synced library across dramas, movies, specials, and TV shows.

When you open the **Show more** modal, the extension upgrades poster quality by fetching higher-resolution poster images from title pages and storing them in a local cache.
The modal also shows:
- the watch status for each matched title (`Completed`, `Watching`, `On Hold`, `Dropped`)
- the type of credit for that person (`Main Role`, `Support Role`, `Director`, `Writer`, etc.)

## Usage

1. Open the extension popup
2. Enter your MyDramaList username
3. Click **Sync watched lists**
4. Visit a person page on MyDramaList, for example:
   - actor pages
   - director pages
   - writer pages
5. The extension will show a banner if it finds titles from your synced library
6. Click **Show more** to open the full modal

## Settings

The popup settings panel currently includes:
- **Include staff credits**  
  When enabled, the extension also checks non-acting credits such as director, writer, screenwriter, composer, and similar roles. By default, this is enabled.
- **Clear synced data**  
  Removes your saved username, synced titles, last sync timestamp, and poster cache from local storage. This requires an "Are you sure?" confirmation.

## Data storage and privacy

This extension stores data **locally in your browser** using `chrome.storage.local`.
No account data is sent to any server controlled by this project.

Stored data may include:
- your MDL username
- synced title IDs
- synced title metadata
- last synced timestamp
- local poster cache
- staff-credit setting

### Important
- This extension does **not** use a custom backend or external database
- Requests are made only to MyDramaList pages needed for:
  - syncing your MDL lists
  - reading visible credits on person pages
  - fetching higher-resolution poster images

## Limitations

- It depends on MDL’s current page structure and visible table layout
- If MDL changes its markup or section structure, some matching logic may need updates
- The extension is currently designed for **desktop browser use**
- It is not intended for the MyDramaList mobile app

## Current behavior notes

- The banner preview favors recent matched titles
- The modal shows matched titles with watch status and credit labels
- High-resolution posters are loaded on demand when opening the modal (but when opening for the first time, lower quality ones or non-existent ones will be rendered)
- Posters are cached locally with a size limit to avoid unbounded storage growth

## Contributing

Issues and pull requests are welcome.

If you report a bug, it helps a lot if you include:

- browser name and version
- screenshots
- the MDL page URL
- what you expected to happen
- what actually happened

## Development notes

This project is intentionally lightweight and currently uses plain JavaScript, HTML, and CSS.

That choice keeps the extension simple, fast, and easy to inspect while developing against a live website DOM.

## Disclaimer

This project is an independent fan-made browser extension and is **not affiliated with MyDramaList**.

## License

MIT
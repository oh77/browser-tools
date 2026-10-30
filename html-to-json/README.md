# Table Export

Browser extension for Chrome, Edge, and Firefox. Pick a table on any page and export it as **JSON, XML, CSV, TSV, or clean HTML**. You can download the result or copy it to the clipboard.

## Use

1. Click the toolbar button or press **Alt+Shift+T** (**Control+Shift+T** on macOS).
2. Hover over a table and click it. You can also press **Enter** to select the highlighted table. **↑/↓** move to the outer or inner table when tables are nested, and **Esc** cancels.
3. In the panel, choose a format and options, check the preview, then click **Copy** or **Download**.

It handles `<table>` elements (including `rowspan`/`colspan`, multi-row headers, `<tfoot>` and nested tables) and ARIA `role="table|grid|treegrid"` structures. Layout tables marked `role="presentation"` are ignored. Under **Exclude**, you can leave out columns without a title (all header cells blank), columns with no data (no cell in the column has content, whatever its title; cells merged in from another column, such as section title rows, don't count) and rows with no data (every cell blank; header rows are kept), in any format. The last format and options you used are remembered.

Tables inside iframes work too, and the panel always opens on the main page. The extension can read iframes from the same site right away. For iframes from another site (embedded spreadsheets, charts and so on), the banner shows an **Allow access** button. It opens a small window that asks for permission to read just those sites. Once you allow it, the extension picks up those frames from then on.

The extension asks for `activeTab`, `scripting`, `storage` and `downloads`. Access to other sites is an optional permission, requested per site only when you click **Allow access**. The extension runs on a page only after you click the toolbar button or press the shortcut.

## Develop

```sh
pnpm install
pnpm test            # vitest unit tests (happy-dom)
pnpm compile         # type-check
pnpm dev             # Chrome with hot reload (dev:edge, dev:firefox also available)
pnpm build           # dist/{chrome,edge,firefox}-mv3
pnpm zip             # store packages in dist/
node scripts/make-icons.mjs   # regenerate public/icon/*.png
```

## Test locally

### 1. Run the unit tests

```sh
pnpm test        # run once
pnpm vitest      # watch mode
pnpm compile     # type-check
```

These tests cover extraction (spans, header detection, nested tables, ARIA grids, HTML sanitizing) and every output format. They run in happy-dom, so no browser is needed.

### 2. Serve the demo page

`test/fixtures/demo.html` contains a table with merged cells, a header and footer, links, a script and hidden text in cells, plus a table with an untitled column, an empty column and blank rows, a nested table, an ARIA grid and a layout table that should be ignored.

`test/fixtures/frames.html` contains tables inside a same-origin iframe, a `srcdoc` iframe and a cross-origin iframe. The cross-origin frame loads the same server through `127.0.0.1`, so open the page via `localhost`.

```sh
python3 -m http.server 8000 -d test/fixtures
# open http://localhost:8000/demo.html
# open http://localhost:8000/frames.html
```

Serve the page over http. On `file://` pages the extension only works after you turn on "Allow access to file URLs" on its details page.

### 3. Load the extension

Build first with `pnpm build`, which writes to `dist/<browser>-mv3/`. You can also use dev mode (below), which rebuilds whenever you save a change.

**Chrome**

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose `dist/chrome-mv3`.
3. Optionally, pin the extension: open the puzzle-piece menu in the toolbar and click the pin.

**Edge**

1. Open `edge://extensions` and turn on **Developer mode** (left sidebar).
2. Click **Load unpacked** and choose `dist/edge-mv3`.

**Firefox** (140 or newer)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…** and choose `dist/firefox-mv3/manifest.json`.
3. Temporary add-ons are removed when Firefox restarts, so you'll need to load it again after a restart.

**Dev mode:** `pnpm dev`, `pnpm dev:edge` and `pnpm dev:firefox` open a fresh browser profile with the extension already loaded, and reload it whenever you save a change. If the browser doesn't open, or opens without the extension, use the manual steps above. Some branded Chrome versions ignore extensions loaded from the command line.

**After code changes (without dev mode):** run `pnpm build` again, then click the reload icon on the extension's card. In Firefox, click **Reload** in `about:debugging`. Also reload the web page you're testing on, so it gets the new picker script.

### 4. Check the extension by hand

Use `http://localhost:8000/demo.html` and go through this list:

- [ ] The toolbar button and **Alt+Shift+T** (**Control+Shift+T** on macOS) both start pick mode. Pressing either again stops it.
- [ ] Hovering over a table outlines it and shows its size. The layout table at the bottom is never highlighted.
- [ ] Clicking the "North" cell selects the table without triggering the page's `alert`.
- [ ] Hovering over the inner (nested) table and pressing **↑** selects the outer table. **↓** goes back to the inner one. **Enter** selects the highlighted table.
- [ ] Each format tab updates the preview. The header row reads `Region, Q1 / Jan, Q1 / Feb, Notes`. With **Repeat merged cells** on, the merged "North" fills both of its rows.
- [ ] On the "Sparse columns" table, **Exclude → Columns without title** drops the unlabeled "Edit" column, and **Columns with no data** drops "Discount", even though it has a title and the "October" section row spans it. The header line shows how many columns were excluded. In HTML, the merged "1003" cell loses its `colspan`. **Rows with no data** drops the blank row, and also the row with only an "Edit" link once the untitled column is excluded.
- [ ] In the HTML output, the link has an absolute URL, and there's no `<script>`, `style` or `onclick`, and no text from the hidden span.
- [ ] **Copy** puts the output on the clipboard. **Download** saves a file named like `quarterly-sales-notes-YYYYMMDD-HHMMSS.json`.
- [ ] The ARIA grid exports with the caption "Team members" and shows the note about rendered rows only.
- [ ] Close the panel and pick a table again: the last format and options are still selected.
- [ ] **Esc** closes the panel or stops pick mode.

Then use `http://localhost:8000/frames.html`:

- [ ] Tables in the same-origin and `srcdoc` iframes highlight on hover. Clicking one opens the panel on the main page with the note "From an embedded frame".
- [ ] The picked table stays outlined in green inside its iframe while the panel is open.
- [ ] The banner says the frame from `127.0.0.1:8000` can't be read yet. **Allow access** opens a small window listing that site. After you click **Allow**, pick mode restarts and the cross-origin table can be picked. Its panel note names the frame's site.
- [ ] **Esc**, **Close** and a second toolbar click remove the UI from every frame.
- [ ] To test the permission prompt again, remove the site access. Chrome/Edge: the extension's details page → **Site access**. Firefox: `about:addons` → the extension → **Permissions**.

Also try a few real pages, such as a Wikipedia article with sortable tables and a web app that uses a `role="grid"` data grid. Check that the panel looks right in dark mode.

**Shortcut conflicts:** if the shortcut does nothing, another extension may already use it. The browser only applies the suggested shortcut when the extension is installed, so after changing it in `wxt.config.ts`, remove the extension and load it again. Change it at `chrome://extensions/shortcuts`, `edge://extensions/shortcuts`, or in Firefox under `about:addons` → gear icon → **Manage Extension Shortcuts**.

**Debugging:**
- Picker and panel errors appear in the web page's DevTools console.
- Background errors, such as failed downloads or pages where the extension can't run, appear in the service worker console. In Chrome or Edge, click **service worker** on the extension's card. In Firefox, click **Inspect** in `about:debugging`.
- A red **!** badge on the toolbar button means the browser blocks extensions on that page. Examples are `chrome://` pages, extension stores and the PDF viewer.

## Layout

- `lib/extract/`: DOM → `SourceTable` (HTML tables, ARIA grids, cell text, HTML sanitizing)
- `lib/grid.ts`: `SourceTable` → rectangular `TableModel` (span expansion, header detection)
- `lib/convert/`: pure converters plus the format/option registry that drives the panel
- `lib/inject.ts`, `lib/messages.ts`: inject into all frames and coordinate them through the background
- `entrypoints/background.ts`: toolbar click or shortcut, message relay between frames, downloads
- `entrypoints/picker/`: the UI injected into each frame (hover picker, plus the preview panel in the top frame), inside a shadow root
- `entrypoints/grant/`: the window that asks for access to cross-origin iframes

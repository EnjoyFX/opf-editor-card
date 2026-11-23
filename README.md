# opf-editor-card

A one-page presentation editor you can drop into an app as a card: open `.opf.md` / `.opf.json` / `.opf.yaml` decks from a folder, edit them as Markdown or on the slide, preview, present, and export PowerPoint. It is a thin host around the [OpenPresentation](https://github.com/OpenPresentation/opf) editor (`@openpresentation/opf-editor`, MIT).

## Features

- **Files from a folder.** Decks live in `decks/` (or `DECKS_DIR`). A file menu, **New**, and **Save** (Ctrl/Cmd+S) write them back as you wrote them.
- **Markdown first.** The source pane edits the deck's own format, with completions, hover help and findings under the code.
- **Slide editing.** Click text on the slide to edit it. Use Sorter, Outline, Layouts, Find and Present (F5) from the editor's own toolbar.
- **Review.** The editor's checker covers format, references, contrast, text fit, alt text and placeholders.
- **Export.** PowerPoint (.pptx, editable), PDF, PNG/SVG zip, and JSON/YAML/Markdown, all generated in the browser.
- **Layout toggles** (added here):
  - **Code** shows or hides the source pane.
  - **Review** shows or hides the right panel.
  - **Slides left** moves the thumbnails into a PowerPoint-style column left of the slide; turned off, they sit in a row below it.

  The toggles are remembered per browser.
- **`?deck=<file>`** opens a given deck, so a card can link straight to one presentation.
- **Custom fonts.** Drop `.ttf`/`.otf` files into `fonts/`. The preview, the PowerPoint export and `npm run export` all pick them up; see [Custom fonts](#custom-fonts).
- **Pictures.** A deck can use images next to it, such as `decks/images/bg.png`, for picture backgrounds and image blocks; see [Pictures and backgrounds](#pictures-and-backgrounds).

## Requirements

- **Node.js 22 or later** (tested on 23), on Linux or macOS. On Linux, install Node from [nodesource](https://github.com/nodesource/distributions) or with `nvm`, because distro packages are often older.
- **About 50 MB disk.** `npm install` copies the preview fonts (~34 MB) into `public/opf-fonts/`; the build output is ~47 MB.

## Run it

```sh
npm ci                # or npm install; postinstall copies the preview fonts
npm run dev           # http://localhost:5179/ (Vite dev server, deck API included)
```

Production (no Vite at runtime; `server/serve.js` has no dependencies):

```sh
npm run build         # -> dist/
npm start             # http://127.0.0.1:5179/
HOST=0.0.0.0 PORT=8080 DECKS_DIR=/srv/decks FONTS_DIR=/srv/fonts npm start
```

Export from the command line, with the custom fonts and the deck's pictures:

```sh
npm run export -- decks/my-talk.opf.md out/my-talk.pptx     # also .pdf, .png, or .svg (one file per slide)
```

A Jira CSV export becomes a feature table slide (Feature · BV · Ticket · Status) with `npm run jira-csv -- features.csv`; see [docs/jira-csv.md](docs/jira-csv.md).

Change one slide of a Markdown deck by its `id` and leave the rest of the file as it is:

```sh
npm run slide -- list   decks/my-talk.opf.md                     # number, id and title of each slide
npm run slide -- get    decks/my-talk.opf.md kpis kpis.md        # one slide to a file (no file: print it)
npm run slide -- set    decks/my-talk.opf.md kpis.md             # replace the slide with the same id, or add it
npm run slide -- set    decks/my-talk.opf.md new.md --after kpis # add after (or --before) another slide
npm run slide -- remove decks/my-talk.opf.md kpis
```

`set` and `remove` validate the new deck first and write nothing when it would have an error. A slide file holds one slide with no front matter; its id comes from its `<!-- slide: id=… -->` comment or from `--id`. OPF Markdown has no include of other files, so a slide kept in its own file is put into the deck with `set`.

npm 11 may print `allow-scripts ... esbuild (postinstall)`. You can ignore it: esbuild works without that script.

### Linux service (systemd example)

```ini
# /etc/systemd/system/opf-editor-card.service
[Unit]
Description=opf-editor-card
After=network.target

[Service]
WorkingDirectory=/opt/opf-editor-card
Environment=PORT=5179 HOST=127.0.0.1 DECKS_DIR=/opt/opf-editor-card/decks FONTS_DIR=/opt/opf-editor-card/fonts
ExecStart=/usr/bin/node server/serve.js
Restart=on-failure
User=www-data

[Install]
WantedBy=multi-user.target
```

## Custom fonts

1. Put the font files into `fonts/` (or `FONTS_DIR`): one `.ttf` or `.otf` per weight and style, for example `Inter-Regular.ttf` and `Inter-Bold.ttf`. Family, weight and italic are read from the files themselves, so the file names do not matter.
2. Name the families in the deck:
   ```yaml
   design:
     fontScheme:
       major: Montserrat   # headings
       minor: Inter        # body text
   ```
3. Reload the page. The fonts are listed once, when the page loads.

**Licences.** Use fonts whose licence allows embedding and redistribution: OFL, Apache-2.0 or MIT, such as Google Fonts. The preview embeds the font files in the page.

**PowerPoint.** The exported `.pptx` names the font but does not include the file. Anyone who opens it without the font installed sees a substitute.

**Already bundled.** Many families ship with the renderer: Roboto, Montserrat, Poppins, Open Sans, Raleway, Lora, Merriweather Sans, Playfair Display, Barlow, Figtree, Work Sans and more. A copy of one of those in `fonts/` is skipped with a warning, and the bundled face is used.

## Pictures and backgrounds

Put images next to the decks, for example `decks/images/bg.png`, and refer to them relative to the deck:

```yaml
design:
  background:
    type: image
    src: ./images/bg.png
    fit: cover                            # cover | contain | stretch | tile
    overlay: { color: dark1, opacity: 0.4 } # keeps text readable
```

Other background types:
- a colour: a scheme slot such as `dark2`, or a `#hex` value;
- a gradient: `type: gradient` with `stops`;
- a pattern.

Any of these can be set for the whole deck (front matter) or for one slide (an `opf-slide` fence).

**Image sources.** Remote `https://` images are **not** fetched: the renderer works offline by design. Use a local file or a `data:` URI.

**New images.** The page loads a deck's images when the deck is opened. An image path you type later shows up after you save and reopen the deck.

## Put it in your app

- **As an iframe card** (simplest): `<iframe src="http://127.0.0.1:5179/?deck=my-talk.opf.md" style="width:100%;height:100%;border:0"></iframe>`.
- **Under a sub-path** of your app (`/presentations/`): proxy that path to this server. The page uses relative URLs only (`base: "./"`, `api/decks`, `opf-fonts/`). The page URL must end with `/`. This setup is designed for but not yet tested behind a proxy.
- **Security:** the API **has no authentication** and writes files. Keep it on `127.0.0.1` behind your app, or add auth in your proxy. Limits:
  - deck names: `*.opf.{md,json,yaml}` inside `DECKS_DIR`, no paths;
  - images and fonts: never resolved outside their folders;
  - request bodies: 10 MB at most.

### HTTP API (`server/deck-api.js`)

| Method | Path | Result |
| --- | --- | --- |
| GET | `/api/decks` | JSON array of deck file names |
| GET | `/api/decks/<name>` | the file's text |
| PUT | `/api/decks/<name>` | writes the request body (creates or replaces) |
| GET | `/api/files/<path>` | an image inside `DECKS_DIR` (png, jpg, gif, webp, svg) |
| GET | `/api/fonts` | the custom faces: `[{ family, weight, italic, sha256, url }]` |
| GET | `/api/fonts/<file>` | a font file from `FONTS_DIR` |

## Project layout

```
index.html            page shell: file menu, New, status line, #editor
src/main.js           mounts the editor per file, Save, toggles, fonts, images, PowerPoint export hook
src/card.css          layout toggles (CSS over the editor's internal classes)
server/deck-api.js    HTTP API: decks, images, fonts (used by Vite dev and by serve.js)
server/fonts.js       lists fonts/ and reads family/weight/style from each file (fontkit)
scripts/export.js     command-line export with the custom fonts (npm run export)
scripts/check.js      validation with the custom fonts (npm run check)
scripts/jira-csv.js   Jira CSV export -> feature table slide (npm run jira-csv), see docs/jira-csv.md
scripts/slide.js      list, get, set or remove one slide by id (npm run slide); scripts/slides.js does the work
server/serve.js       production static server + API
vite.config.js        dev server + build (relative base)
decks/                your presentations and their images (git-ignored)
fonts/                your custom font files (git-ignored)
public/opf-fonts/     preview fonts, generated by npm install (git-ignored)
```

## For agents

This section tells an AI agent how to work in this repo: writing decks, and changing the card.

### 1. Writing or editing a presentation

**Where the decks are.** Decks are files in `decks/` (or `$DECKS_DIR`). Prefer **`.opf.md`**: it is readable and diffs well. JSON is the canonical form; YAML and Markdown convert to it losslessly.

**Markdown dialect, the essentials** (full spec: [docs/markdown.md](https://github.com/OpenPresentation/opf/blob/main/docs/markdown.md)):

````md
---
name: Deck name
language: en-US
design:
  theme: classic
  colorScheme: corporate-blue
  fontScheme: calibri
  background: light1
---

<!-- slide: id=cover layout=cover -->
# Title
## Subtitle
Note: speaker notes run to the next ---

---

<!-- slide: id=kpis layout=metrics -->
# Headline numbers

```metric
value: 4.8
unit: M
label: Revenue
delta: +12%
trend: up
```

---

<!-- slide: id=trend layout=chart-beside -->
# Revenue up [41%]{color=accent1}

```chart column alt="What the chart shows, in one sentence."
Quarter,Revenue
Q1,3.4
Q2,4.8
```

- Point one
  : its description
````

**Field values used above:**
- `language`: a BCP-47 tag, such as `en-US`, or `uk-UA` for Ukrainian.
- `theme`: `minimal`, `classic` or `bold`.
- `background`: a scheme slot (`light1`, `light2`, `dark1`, `dark2`, `accent1`…) or a `#hex` colour.
- `trend`: `up`, `down` or `flat`. Add `sentiment: positive` when "down" is good, as for churn or cost.
- Don't put comments inside `metric` fences. They are not YAML, so a comment becomes part of the value.

**Other blocks:**
- **Tables:** pipe tables (`| a | b |` plus a `| --- |` row).
- **Timelines:** ```` ```timeline ```` with `[x]` done, `[>]` current, `[ ]` planned.
- **Diagrams:** ```` ```mermaid ````.
- **Quotes:** `> text` plus `> — Name, Title`.
- **Images:** `![alt](src)`.
- **Anything without Markdown syntax** goes in a YAML fence: ```` ```opf-slide ```` (slide fields such as `design`) or ```` ```opf-block ```` (one block). Examples: per-slide background, combo charts with a second axis, number formats.

**Catalog ids:**
- **Layouts:** `cover section agenda agenda-split statement closing text list quote two-column three-column pillars comparison process timeline faq pyramid inverted-pyramid matrix cycle chevrons flow vertical-flow org-chart hierarchy venn metrics scorecard image image-beside gallery chart chart-beside table table-beside code hero dashboard team logos`.
- **Color schemes:** `black-and-white bold-red boost burnt-orange cool-horizon corporate-blue deep-purple forest-green golden-yellow luxury pastel-red slate-gray steel-blue vibes`.
- **Font schemes (89):** list them with:
  ```sh
  node -e 'import("@openpresentation/gallery").then(({gallery})=>console.log(Object.keys(gallery.fontSchemes).join(" ")))'
  ```
  Prefer this over `opf catalog`, which was very slow in our tests.

**Workflow loop.** Do this after every edit. A deck is done when `npm run check` passes: no errors or warnings.

```sh
npm run check -- decks/my-talk.opf.md                              # validate, text fit measured with fonts/
npm run export -- decks/my-talk.opf.md /tmp/preview/slide.svg      # one SVG per slide; look at them
npm run export -- decks/my-talk.opf.md /tmp/my-talk.pptx           # PowerPoint
```

Use these scripts, not the `opf` CLI directly, because the scripts load the files in `fonts/` with their real weights. The CLI (`@openpresentation/cli` 0.34.2) handles custom fonts badly:
- `opf validate` has no `--fonts` option, so on a deck that uses a font from `fonts/` it can only report `opf/layout-failed`.
- `opf convert --fonts <dir>` registers every file as weight 400, so a family with both a regular and a bold file fails with `Duplicate face`.

For decks that use only bundled fonts, `npx opf validate … --fail-on warning` and `npx opf convert …` work fine.

A font the deck names that is neither bundled nor in `fonts/` makes export fail with `font-unavailable`.

Convert the SVGs to PNG to look at them, for example with headless Chrome: `chrome --headless=new --screenshot=out.png --window-size=1280,720 file:///tmp/preview/slide-1.svg`.

**Rules:**
- Never invent business numbers. If the user gives no data, say the figures are samples, on the cover too.
- Keep figures consistent across slides: totals equal the sum of their parts, and deltas match the charts.
- Give every chart an `alt` sentence that states the takeaway.
- Keep slide `id`s stable so the user can say "on slide `scorecard`…".
- One claim per slide title. Split a slide rather than shrinking text.

**Known quirks:**
- **Text on gradients.** Text colour follows a *solid* background automatically, but not a gradient. On a dark gradient, colour the title yourself: `# [Title]{color=light1}`. `opf/text-contrast` may still warn even though the text renders light; check the SVG.
- **Number format.** A CSV chart body cannot carry a number format (`4.0` prints as `4`). Use a JSON body with `{ "name": "Revenue", "format": "0.0" }`; it is then written as an `opf-block`.
- **Fonts in preview vs PowerPoint.** Microsoft fonts (Calibri, Aptos, Georgia…) are previewed with metric-compatible open fonts. The .pptx keeps the real font name.
- **Language.** For Ukrainian or other non-Latin text, pick fonts with Cyrillic and set `language`.

The official agent skills for OPF can be added with `npx opf skills install --agent claude-code` (or `codex`, `cursor`, `universal`); see [docs/agent-skills.md](https://github.com/OpenPresentation/opf/blob/main/docs/agent-skills.md).

### 2. Changing the card itself

- **Keep versions in step.** All `@openpresentation/*` packages are pinned to the same version (0.34.2) and must move together.
- **Remount per file.** `src/main.js` creates one editor per open file (`mount`) and destroys it on file switch. This keeps undo history from crossing files and makes Save write the file that is shown. Keep that.
- **Markdown format names.** Core `parse()` calls the format `"markdown"`, but the editor's source pane calls it `"md"`. Pass `filename` to `parse` instead of `format`.
- **PowerPoint export.** It is not built into the editor; `export.exportPptx` in `main.js` supplies it with `toPptx` from `@openpresentation/opf-pptx`, using the same fonts handle as the preview and an `imageResolver` that returns the image bytes.
- **Fonts in the browser.** `loadCardFonts()` in `main.js` repeats what `loadPreviewFonts` does and adds the faces from `/api/fonts` as `extraLazyFonts`. It does not use `loadPreviewFonts`' `registryOptions`, because that option replaces the bundled lazy faces instead of adding to them. Faces must carry explicit weights: the renderer does not read the weight from the file.
- **Images in the browser.** The renderer draws only embedded pictures (data URIs) and never fetches, and the editor keeps slides it has already drawn: a picture that arrives later is not redrawn, even by `refresh()`. So `open()` fetches every relative image path in the deck as a data URI before it creates the editor.
- **Toolbar action ids.** Ids in `actions` must not collide with the editor's own `data-action` values (`save`, `cancel`, `expand`, `previous`, `next`, `ignore-rule`). Using `save` here broke the Save button once.
- **Toggle CSS.** The toggles in `src/card.css` target internal classes (`.opf-ws-source`, `.opf-ws-side`, `.opf-ws-main`, `.opf-ws-dock`, `.opf-thumbs`, `.opf-thumbs-list`): the editor has no runtime API to hide panels, and recreating it loses undo. **After upgrading `@openpresentation/opf-editor`, re-test all three toggles.**
- **Canvas edits rewrite the source.** An edit made on the slide canvas rewrites the whole Markdown in OPF's canonical form when saved: key order changes, and unsupported parts become `opf-block` YAML. Edits typed in the source pane keep the author's text. Tell users this if they care about the file's exact layout.
- **Editor options** (layouts `full | canvas | embed | studio | playground | source`, `toolbar`, `slots`, `theme` tokens, `readOnly`, `persistence`) are documented in [packages/editor/docs/embedding.md](https://github.com/OpenPresentation/opf/blob/main/packages/editor/docs/embedding.md) and [theming.md](https://github.com/OpenPresentation/opf/blob/main/packages/editor/docs/theming.md). The type definitions in `node_modules/@openpresentation/opf-editor/dist/workspace.d.ts` are the most precise reference.
- **Checklist before committing:**
  - `npm run build` succeeds.
  - In `npm run dev`, these all work: open a deck, edit in the source, Save, New, the three toggles, and Export → PowerPoint.
  - A deck with a custom font from `fonts/` and a picture background previews and exports with both.

### Links

- [OpenPresentation repo](https://github.com/OpenPresentation/opf) and [pptx.gallery](https://www.pptx.gallery/) (layouts and themes catalog)
- [Authoring OPF with an LLM](https://github.com/OpenPresentation/opf/blob/main/docs/llm-authoring.md)
- [Markdown dialect](https://github.com/OpenPresentation/opf/blob/main/docs/markdown.md) and a [full example deck](https://github.com/OpenPresentation/opf/blob/main/examples/markdown/quarterly-review.opf.md)
- [Content payloads](https://github.com/OpenPresentation/opf/blob/main/docs/content-payloads.md), [charts](https://github.com/OpenPresentation/opf/blob/main/docs/chart-options.md), [chart and table data](https://github.com/OpenPresentation/opf/blob/main/docs/chart-table-data.md)
- [Design: themes, colors, fonts, backgrounds](https://github.com/OpenPresentation/opf/blob/main/docs/design-resolution.md), [images and backgrounds](https://github.com/OpenPresentation/opf/blob/main/docs/image-treatments.md), [layouts](https://github.com/OpenPresentation/opf/blob/main/docs/layout-templates.md)
- [Validation rules](https://github.com/OpenPresentation/opf/blob/main/docs/validate.md), [CLI](https://github.com/OpenPresentation/opf/blob/main/docs/cli.md)
- [Editor README](https://github.com/OpenPresentation/opf/blob/main/packages/editor/README.md), [embedding](https://github.com/OpenPresentation/opf/blob/main/packages/editor/docs/embedding.md), [browser editing](https://github.com/OpenPresentation/opf/blob/main/docs/live-editor.md)

## License

MIT, see [LICENSE](LICENSE). The OpenPresentation packages it uses are MIT-licensed too.

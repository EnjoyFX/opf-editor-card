import "@openpresentation/opf-editor/styles.css";
import { createOpfEditor } from "@openpresentation/opf-editor/workspace";
import { gallery } from "@openpresentation/gallery";
import { loadPreviewFonts } from "@openpresentation/opf-render/preview-fonts";
import { parse } from "@openpresentation/opf";

// All URLs are relative to the page, so it also works under a sub-path of your app.
const API = "api/decks";
const STARTER = `---
name: Untitled
language: en-US
design:
  theme: classic
---

# Untitled presentation

## Subtitle
`;

const host = document.querySelector("#editor");
const fileSelect = document.querySelector("#file");
const newButton = document.querySelector("#new");
const status = document.querySelector("#status");
const formatOf = (name) => name.match(/\.opf\.(md|json|yaml)$/)[1];
const baseName = (name) => name.replace(/\.opf\.\w+$/, "");
const fonts = loadPreviewFonts("opf-fonts/");

// ---- Layout toggles. Hidden with CSS rather than a remount, so undo history and the open slide survive.
const shown = { source: true, review: true, thumbsLeft: false };
try {
  Object.assign(shown, JSON.parse(localStorage.getItem("opf-card-panels") ?? "{}"));
} catch {}
function setShown(panel, value) {
  shown[panel] = value;
  host.classList.toggle("hide-source", !shown.source);
  host.classList.toggle("hide-review", !shown.review);
  host.classList.toggle("thumbs-left", shown.thumbsLeft);
  try {
    localStorage.setItem("opf-card-panels", JSON.stringify(shown));
  } catch {}
}
setShown("source", shown.source);

// ---- Deck files (server/deck-api.js).
async function listDecks() {
  const res = await fetch(API);
  if (!res.ok) throw new Error(`Cannot list decks: ${await res.text()}`);
  return res.json();
}
async function readDeck(name) {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`);
  if (!res.ok) throw new Error(`Cannot read ${name}: ${await res.text()}`);
  return res.text();
}
async function writeDeck(name, text) {
  const res = await fetch(`${API}/${encodeURIComponent(name)}`, { method: "PUT", body: text });
  if (!res.ok) throw new Error(`Cannot save ${name}: ${await res.text()}`);
}
function showFiles(files, selected) {
  const names = files.includes(selected) ? files : [...files, selected];
  fileSelect.replaceChildren(...names.map((name) => new Option(name, name, false, name === selected)));
}

// ---- One editor per open file, bound to that file's name: undo history never crosses files,
// and Save always writes the file shown.
let editor = null;
let current = null;

function mount(name, text) {
  // parse() names Markdown "markdown"; the source pane names it "md". Passing the file name avoids the mismatch.
  const document = parse(text, { filename: name, catalogs: [gallery] });
  const instance = createOpfEditor(host, {
    document,
    catalogs: [gallery],
    fonts,
    layout: "full",
    source: { format: formatOf(name), text, name: baseName(name) },
    // PowerPoint export is not built into the editor: the host supplies it.
    export: {
      async exportPptx(deck, { pictureLuminance }) {
        const { toPptx } = await import("@openpresentation/opf-pptx");
        const handle = await fonts;
        await handle.ensure?.(deck);
        return toPptx(deck, { catalogs: [gallery], fonts: handle, pictureLuminance });
      },
    },
    actions: [
      {
        id: "save-file",
        label: "Save",
        title: "Save to the server (Ctrl/Cmd+S)",
        primary: true,
        enabled: () => instance.dirty,
        run: () => instance.save(),
      },
      {
        id: "toggle-source",
        label: "Code",
        title: "Show or hide the source editor",
        icon: "M8 6l-6 6 6 6M16 6l6 6-6 6",
        pressed: () => shown.source,
        run: () => setShown("source", !shown.source),
      },
      {
        id: "toggle-review",
        label: "Review",
        title: "Show or hide the Review panel",
        icon: "M3 4h18v16H3zM15 4v16",
        pressed: () => shown.review,
        run: () => setShown("review", !shown.review),
      },
      {
        id: "toggle-thumbs",
        label: "Slides left",
        title: "Thumbnails in a column left of the slide (PowerPoint) or in a row below it",
        icon: "M3 4h18v16H3zM9 4v16",
        pressed: () => shown.thumbsLeft,
        run: () => setShown("thumbsLeft", !shown.thumbsLeft),
      },
    ],
    guardUnload: true,
    onError: (error) => (status.textContent = `Error: ${error.message}`),
  });

  // The toolbar's review pill opens the Review panel: bring it back if it was hidden.
  instance.on("panel", ({ panel }) => {
    if (panel === "review" && !shown.review) setShown("review", true);
  });
  instance.on("ready", () => (status.textContent = `${name} — Ctrl/Cmd+S saves`));
  instance.on("dirty", ({ dirty }) => (status.textContent = dirty ? `${name} — unsaved changes` : `${name} — saved`));
  instance.on("save", async ({ text, format, draft }) => {
    if (draft) return (status.textContent = "Not saved: the source has errors (see the list under the code)");
    if (format !== formatOf(name)) return (status.textContent = `Not saved: switch the source format back to .opf.${formatOf(name)}`);
    try {
      await writeDeck(name, text);
      instance.markSaved();
      showFiles(await listDecks(), name);
    } catch (error) {
      status.textContent = error.message;
    }
  });
  return instance;
}

async function open(name, text) {
  if (editor?.dirty && !confirm(`${current} has unsaved changes. Discard them?`)) {
    fileSelect.value = current;
    return;
  }
  status.textContent = `Opening ${name}…`;
  try {
    text ??= await readDeck(name);
    editor?.destroy();
    current = name;
    editor = mount(name, text);
    window.opfEditor = editor;
    const url = new URL(location.href);
    url.searchParams.set("deck", name);
    history.replaceState(null, "", url);
  } catch (error) {
    status.textContent = error.message;
    fileSelect.value = current ?? "";
  }
}

fileSelect.addEventListener("change", () => open(fileSelect.value));

newButton.addEventListener("click", async () => {
  const input = prompt("Name of the new presentation", "untitled");
  if (!input) return;
  const name = `${input.trim().toLowerCase().replace(/[^\w.-]+/g, "-").replace(/\.opf\.(md|json|yaml)$/, "")}.opf.md`;
  const files = await listDecks();
  if (files.includes(name)) return alert(`${name} already exists.`);
  await writeDeck(name, STARTER);
  showFiles([...files, name].sort(), name);
  await open(name, STARTER);
});

// ---- Start: ?deck=<name> opens that deck; otherwise the first one; with no decks, an unsaved starter.
try {
  const files = await listDecks();
  const wanted = new URL(location.href).searchParams.get("deck");
  const first = files.includes(wanted) ? wanted : files[0];
  if (first) {
    showFiles(files, first);
    await open(first);
  } else {
    showFiles([], "untitled.opf.md");
    await open("untitled.opf.md", STARTER);
    status.textContent = "No decks yet: this one is created on the first save";
  }
} catch (error) {
  status.textContent = error.message;
}

# Remote page preview

This document explains how the Sveltia CMS entry preview is wired to a remote
rendering API, so that editors see a page rendered exactly as it would appear
on the live Open Food Facts website.

It is a companion to [`explain-sveltia.md`](./explain-sveltia.md), which covers
the CMS installation itself. Read that first if the Sveltia setup is unclear.

## Why a remote preview

The default Sveltia preview renders Markdown inline in the browser,
with images resolved to ephemeral blob URLs.
That is convenient, but it is **not** what the live site shows:
the explorer renders Markdown with its own parser, templates, styles and shortcodes,
and the result rarely matches a plain Markdown render.

On the other end, for non technical users,
the preview is a very important feature to see if their markdown match their intent.

That's why we are replacing the built-in preview with a live call to the explorer.
This document describes that integration.

## How it is opted in

The feature is purely client-side and switched on by a single environment
variable, read at build time like the other `VITE_CMS_*` values in
[`src/lib/cms-config.ts`](../src/lib/cms-config.ts):

```
VITE_PREVIEW_API_URL=https://beta.openfoodfacts.net/contents/preview
```

`VITE_PREVIEW_API_URL` is the **full endpoint URL** the browser posts to.

- **When `VITE_PREVIEW_API_URL` is set**, Sveltia's built-in preview is replaced
  with the remote-rendering template described below.
- **When it is unset**, no custom template is registered and the CMS behaves
  exactly as it did before — a fresh checkout with the default `test` backend
  gets the unchanged built-in preview.

## The request contract

The browser `POST`s to `VITE_PREVIEW_API_URL` with a JSON body of the shape:

```json
{
	"content": "---\ntitle: Discover\n---\n\nContent for the Discover page goes here.",
	"assets_context": {
		"repo": "openfoodfacts/openfoodfacts-content",
		"branches": ["cms/pages/discover", "main"],
		"pathMap": { "/uploads/": "static/uploads/" }
	}
}
```

### `content`

The full Markdown file reconstructed from the entry draft: YAML frontmatter
followed by the Markdown body, exactly as it is stored under
`content/{{locale}}/{{name}}.md`. The server parses the frontmatter itself and
renders the page, so adding a frontmatter field to the collection config flows
through without any change to the preview code — only the field whose widget is
`markdown` is treated as the body and written below the frontmatter fence;
every other top-level field becomes a frontmatter key.

The frontmatter is serialized with [`js-yaml`](https://github.com/nodeca/js-yaml).

### `assets_context`

Tells the server how to rewrite media references (e.g. `/uploads/foo.png`) into
GitHub raw URLs, so the rendered HTML can load images.

- **`repo`** is `owner/repo` of the content repository.
- **`branches`** is an ordered list: the Editorial Workflow **draft branch**
  first (if any), then the **published branch** (`main` by default). The server
  tries each in turn and uses the first that has the file. This lets images
  committed to an entry's draft branch resolve before falling back to `main`.
- **`pathMap`** maps the public URL prefix (`/uploads/`) to the on-disk media
  folder (`static/uploads/`), both taken from the CMS config.

`assets_context` is **omitted entirely** on the `test-repo` backend, since no
GitHub repository exists for the server to read from. Only inlined `data:` URLs
(see below) can render images there.

### Response

The API returns `text/html`: a full HTML document, rendered the same way the
explorer renders a live page. The CMS displays it in a sandboxed `<iframe>`
(via the `srcdoc` attribute).

## How media resolves

There are two paths, depending on whether the image has been saved yet.

### Saved images — server-side rewrite

Images that are already committed are referenced in the Markdown by their
public path (`/uploads/foo.png`). The client sends the Markdown unchanged, plus
the `assets_context`, and the server rewrites those paths to GitHub raw URLs
while it renders, trying the draft branch before `main`.

The browser then loads the resolved `<img src>` directly from
`raw.githubusercontent.com`. This works because the content repository is
public (anonymous reads), and image `GET`s are not subject to CORS for
`<img>` display.

### Unsaved images — client-side inlining

Images that were just uploaded but **not yet saved** exist only as a browser
blob. The remote API has no way to fetch them, so the client inlines them
before sending:

- The preview template scans every field value (body and frontmatter) for
  `blob:` URLs (the references Sveltia inserts for freshly uploaded files).
- For each, it reads the file bytes through the `getAsset(path)` prop Sveltia
  hands the template and rewrites the reference to a `data:` URL embedded
  directly in the Markdown.
- The server renders the Markdown as-is, unaware the image was inlined.

Once the entry is saved, the image is committed to the draft branch and the
saved-image path above takes over — the inlining is transparent.

This relies only on Sveltia's public `getAsset`/`toBase64` API; it touches no
Sveltia internals.

## How it renders in the browser

The custom preview is registered with Sveltia's
[`registerPreviewTemplate`](https://sveltiacms.app/en/docs/api/preview-templates),
which expects a **React** component. It is authored as a thin shell using the
React instance Sveltia bundles (`CMS.React`), with all the real logic —
assembling content, inlining images, building the asset context, debouncing,
caching and fetching — kept in plain TypeScript modules under
[`src/lib/preview/`](../src/lib/preview/). This avoids adding React build
tooling to the project and the duplicate-React hazard that comes with it.

Sveltia looks up a registered template by the **file name** of the entry being
edited (before the collection name), so the same component is registered once
per page in [`src/routes/admin/+page.svelte`](../src/routes/admin/+page.svelte).

### The preview frame

The returned HTML is shown in a nested `<iframe srcdoc>`, distinct from
Sveltia's own preview iframe. It is sandboxed with `allow-scripts` only:

- The rendered Markdown is untrusted user content, and the CMS holds the
  editor's GitHub token, so the iframe runs in an **opaque origin**: scripts
  in the rendered page cannot reach the parent CMS, the token, or its DOM.
- No `allow-same-origin` means no `localStorage`, cookies or credentialed
  `fetch`. This is fine for public-facing pages, which have no need for them.

### Debounce, cache and error states

Each edit is debounced (~400 ms) so rapid typing collapses into a single
request. When a newer edit arrives while a request is still in flight, the
in-flight one is aborted, so the preview always reflects the latest typed
state. A request whose assembled `content` and asset context match a previous
successful render is served from an in-memory cache without hitting the network.

While a request is pending, the previous render stays on screen (no blank
flash) with a small "Updating…" indicator. On HTTP or network failure, a
non-blocking "Preview failed: …" banner is shown instead, and the editor can
keep typing to retry.

## Known limitations

These are accepted for now and may be revisited:

1. **`test-repo` backend.** A saved image cannot resolve in the remote
   preview, because the test backend's in-browser filesystem is unreachable
   from the API. Only images that are still unsaved are inlined and therefore
   visible; once saved they disappear from the preview (text still renders).
   This is the cost of the test backend having no real repository.

2. **Draft-branch media before first save.** Media is committed on entry
   **Save**, not at upload time, so an image uploaded and inserted but never
   saved shows up only via `data:` inlining, never via the GitHub raw URL.

3. **No Open Authoring / fork support.** Drafts are assumed to live on the
   origin content repository's `cms/{collection}/{slug}` branch, not in a
   contributor's fork. Supporting forks would need a UI to supply the
   contributor's fork URL.

## Further reading

- [`explain-sveltia.md`](./explain-sveltia.md) — how Sveltia CMS itself is set
  up in this project.
- [Sveltia preview templates API](https://sveltiacms.app/en/docs/api/preview-templates)
- Sveltia's Editorial Workflow branch naming follows the
  [Decap CMS convention](https://decapcms.org/docs/editorial-workflows/):
  branches are named `cms/{collection}/{slug}`.

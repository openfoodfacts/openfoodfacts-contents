# Explain Sveltia CMS

This document explains how [Sveltia CMS](https://sveltiacms.app/) is set up
and how it fits into the SvelteKit project.
It is a condensed companion to
the [official documentation](https://sveltiacms.app/en/docs/intro).

## What Sveltia CMS is

Sveltia CMS is a modern, Git-based, headless content management system
distributed as a single-page application (SPA)
that editors interact with in the browser.
Content is stored as plain files directly in the Github repository.

- [Introduction](https://sveltiacms.app/en/docs/intro)
- [Architecture overview](https://sveltiacms.app/en/docs/architecture)

## How it is installed in this project

We use the [NPM package](https://sveltiacms.app/en/docs/api).
The CMS is served from a regular SvelteKit route with SSR disabled,
and configuration is defined as typed TypeScript instead of a `config.yml` file.

- [Manual installation](https://sveltiacms.app/en/docs/start#manual-installation)
- [SvelteKit integration guide](https://sveltiacms.app/en/docs/frameworks/sveltekit)
- [JavaScript API](https://sveltiacms.app/en/docs/api)
- [Manual initialization](https://sveltiacms.app/en/docs/api/initialization)

We might have chosen a static + CDN deployment, but it means using a CDN.
The advantage would be the ability to change content directly in a local repository.
(this is maybe not a good practice, as code change should be distinct from contents changes).

### File layout

```
src/
├── lib/
│   └── cms-config.ts          # Typed CMS configuration (env-switched)
└── routes/
    └── admin/
        ├── +page.ts           # Disables SSR for the admin route
        └── +page.svelte       # Imports CMS, calls CMS.init(), mounts #nc-root
content/
├── en/
│   ├── terms-of-use.md        # English pages
│   ├── who-we-are.md
│   └── ...
└── fr/
    ├── terms-of-use.md        # French pages
    ├── who-we-are.md
    └── ...
static/
└── uploads/                   # Media uploads (in-repo)
```

### How the route works

The admin page is **not** a normal SvelteKit page:

- `src/routes/admin/+page.ts` exports `ssr = false` because the CMS SPA needs `window` and `document`, which do not exist during server-side rendering.
- `src/routes/admin/+page.svelte` imports the `CMS` default export and the `config` object, then calls `CMS.init({ config })`.
- `load_config_file: false` is set **inside** the config object, telling Sveltia not to fetch a `config.yml` from the static folder.
- The CMS mounts into `<div id="nc-root"></div>`, which is a [custom mount element](https://sveltiacms.app/en/docs/customization#custom-mount-element) that keeps the CMS scoped to the page.

Links to the admin page should use the [`data-sveltekit-reload`](https://svelte.dev/docs/kit/link-options#data-sveltekit-reload) attribute so the browser loads it as a full page instead of handling it through the client-side router:

```svelte
<a href="/admin" data-sveltekit-reload>Edit content</a>
```

## Configuration

The entire configuration lives in `src/lib/cms-config.ts` and is typed with `CmsConfig` from `@sveltia/cms`. It is built at runtime from `VITE_CMS_*` environment variables.

- [Configuration basics](https://sveltiacms.app/en/docs/config-basics)
- [Customization options](https://sveltiacms.app/en/docs/customization)

### Backend

The backend determines where content commits land. It is switched by `VITE_CMS_BACKEND`:

| Environment           | `VITE_CMS_BACKEND` | Backend           | Authentication                                         |
| --------------------- | ------------------ | ----------------- | ------------------------------------------------------ |
| Development (default) | `test`             | In-browser VFS    | None required                                          |
| Production            | `github`           | GitHub repository | Personal access token (or OAuth client via `base_url`) |

The `test` backend ([docs](https://sveltiacms.app/en/docs/backends/test)) stores content in an ephemeral in-browser filesystem. It is ideal for trying the CMS UI without a remote repository or OAuth setup.

The `github` backend ([docs](https://sveltiacms.app/en/docs/backends/github)) commits to a real repository. GitHub does not yet support client-side PKCE for SPAs, so authentication is currently done by pasting a [personal access token](https://sveltiacms.app/en/docs/backends/github#access-token) into the CMS login screen. When an OAuth client proxy is later deployed, setting `VITE_CMS_BASE_URL` enables the [authorization code flow](https://sveltiacms.app/en/docs/backends/github#authorization-code-flow).

Environment variables:

| Variable            | Required for `github` | Description                            |
| ------------------- | --------------------- | -------------------------------------- |
| `VITE_CMS_BACKEND`  | yes                   | `test` or `github`                     |
| `VITE_CMS_REPO`     | yes                   | `owner/repo` on GitHub                 |
| `VITE_CMS_BRANCH`   | yes                   | Branch commits target (default `main`) |
| `VITE_CMS_BASE_URL` | no                    | URL of an OAuth client proxy           |

Secrets are never embedded in the config — `VITE_CMS_*` vars are public client-side values. The access token is entered per-user in the browser.

### Workflow

`publish_mode: 'editorial_workflow'` is configured for the GitHub backend. This means content changes go through draft → review → ready states, each on its own branch and pull request before merging. The test backend ignores this setting.

- [Workflows overview](https://sveltiacms.app/en/docs/workflows)
- [Editorial workflow](https://sveltiacms.app/en/docs/workflows/editorial)

### Media storage

Media (images, files) is stored **internally in the repository**:

- `media_folder: 'static/uploads'` — where files are saved on disk.
- `public_folder: '/uploads'` — the URL prefix used to reference them.

- [Internal media storage](https://sveltiacms.app/en/docs/media/internal)
- [Media storage overview](https://sveltiacms.app/en/docs/media)

### Page preview

When `VITE_PREVIEW_API_URL` is set, Sveltia's built-in entry preview is replaced
with a live render fetched from the Open Food Facts explorer, so editors see a
page as it would appear on the website. The mechanism, request contract, media
resolution and accepted limitations are documented separately in
[`explain-rendering.md`](./explain-rendering.md). When the variable is unset, the
built-in preview is used unchanged.

### Collections

A single **file collection** named `pages` manages four fixed pages. Each page is one Markdown file per locale, resolved via the `{{locale}}` placeholder in the `file` path:

```
content/en/terms-of-use.md
content/fr/terms-of-use.md
content/en/who-we-are.md
content/fr/who-we-are.md
…
```

- [Collections](https://sveltiacms.app/en/docs/collections)
- [File collections](https://sveltiacms.app/en/docs/collections/files)
- [Content modeling guide](https://sveltiacms.app/en/docs/content-modeling)

### Internationalization (i18n)

The project willl support many languages,
with content stored in separate per-locale files.
The `{{locale}}` placeholder in the file collection paths
produces the `content/en/…` and `content/fr/…` structure.

Both `title` and `body` are marked `i18n: true`,
so each locale has its own independent values.

- [i18n overview](https://sveltiacms.app/en/docs/i18n)
- [i18n configuration options](https://sveltiacms.app/en/docs/i18n/options)
- [i18n content structures](https://sveltiacms.app/en/docs/i18n/structures)

## Running the CMS locally

```sh
nvm use # (or source ./local-nvm.sh) - Load the Node version pinned in .nvmrc
pnpm dev # Start the SvelteKit dev server
```

Then open `http://localhost:5173/admin`. In the default `test` backend, the CMS loads an in-browser virtual filesystem and no authentication is needed.

## Deploying to production

1. Set the `VITE_CMS_*` environment variables on the hosting platform.
2. Register an OAuth app on GitHub (callback URL depends on your auth method).
3. Deploy the SvelteKit app as usual — the admin route is included automatically.

- [Deployments](https://sveltiacms.app/en/docs/deployments)
- [Security & CSP](https://sveltiacms.app/en/docs/security)

## Useful links

- [Official docs home](https://sveltiacms.app/en/docs/intro)
- [Working with AI](https://sveltiacms.app/en/docs/working-with-ai)
- [Troubleshooting](https://sveltiacms.app/en/docs/troubleshooting)
- [FAQ](https://sveltiacms.app/en/docs/faq)
- [GitHub repository](https://github.com/sveltia/sveltia-cms)

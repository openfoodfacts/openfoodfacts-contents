import type { CmsConfig } from '@sveltia/cms';

/**
 * CMS backend configuration, switched at build time via the VITE_CMS_BACKEND env var.
 * In development, the 'test' backend uses an in-browser virtual filesystem.
 * In production, the 'github' backend commits content to a GitHub repository.
 */
const {
	VITE_CMS_BACKEND = 'test',
	VITE_CMS_REPO = 'local/local',
	VITE_CMS_BRANCH = 'main',
	VITE_CMS_BASE_URL,
	VITE_PREVIEW_API_URL
} = import.meta.env;

/**
 * Build the backend object based on the configured mode.
 * GitHub requires a repo and branch; the URL of an optional OAuth client proxy
 * is only included when VITE_CMS_BASE_URL is set.
 */
const backend =
	VITE_CMS_BACKEND === 'github'
		? {
				name: 'github' as const,
				repo: VITE_CMS_REPO,
				branch: VITE_CMS_BRANCH,
				...(VITE_CMS_BASE_URL ? { base_url: VITE_CMS_BASE_URL } : {})
			}
		: {
				name: 'test-repo' as const
			};

/**
 * Field schema shared by every page.
 * Both fields are translatable per locale.
 */
const pageFields = [
	{ name: 'title', label: 'Title', widget: 'string' as const, i18n: true, required: false },
	{ name: 'body', label: 'Body', widget: 'markdown' as const, i18n: true, required: false }
];

/**
 * Pages managed by the CMS, each defined by a slug and a display label.
 * A new page is added by appending an entry here.
 */
export const pages = [
	{ name: 'terms-of-use', label: 'Terms of Use' },
	{ name: 'who-we-are', label: 'Who We Are' },
	{ name: 'data', label: 'Data' },
	{ name: 'discover', label: 'Discover' }
];

const pagesConfig = pages.map(({ name, label }) => ({
	name,
	label,
	file: `content/{{locale}}/${name}.md`,
	i18n: true,
	fields: pageFields
}));

/**
 * Sveltia CMS configuration.
 * Content is stored as one Markdown file per page per locale, under content/{{locale}}/.
 * Editorial workflow enables draft/review/publish states via pull requests on GitHub.
 */
export const config: CmsConfig = {
	load_config_file: false,
	backend,
	publish_mode: 'editorial_workflow',
	media_folder: 'static/uploads',
	public_folder: '/uploads',
	i18n: {
		locales: ['en', 'fr'],
		default_locale: 'en'
	},
	collections: [
		{
			name: 'pages',
			label: 'Pages',
			i18n: true,
			files: pagesConfig
		}
	]
};

/**
 * Full URL of the remote rendering API endpoint (the Open Food Facts explorer) used by the custom
 * entry preview — e.g. `https://beta.openfoodfacts.net/contents/preview`. When unset, the custom
 * preview is not registered and Sveltia CMS falls back to its built-in preview. See
 * `docs/explain-rendering.md`.
 */
export const previewApiUrl: string | undefined = VITE_PREVIEW_API_URL;

/**
 * Name of the field whose value holds the Markdown body (everything below the YAML frontmatter).
 * Every other top-level field in an entry is serialized as frontmatter. Derived from the config so
 * that adding a field flows through without touching the preview code.
 */
export const markdownBodyFieldName: string =
	pageFields.find((f) => f.widget === 'markdown')?.name ?? 'body';

/**
 * Whether the configured backend commits to a real GitHub repository (as opposed to the in-browser
 * 'test-repo' backend, which has no branches the remote API can read).
 */
export const isGitHubBackend: boolean = backend.name === 'github';

/**
 * Static asset-context shared by every preview request on the GitHub backend: the repo, the base
 * (published) branch, and the mapping from the public URL prefix to the on-disk media folder. The
 * draft branch is entry-specific and appended at preview time. See `docs/explain-rendering.md`.
 */
export const githubAssetContext = isGitHubBackend
	? {
			repo: VITE_CMS_REPO,
			mainBranch: VITE_CMS_BRANCH,
			pathMap: { [config.public_folder as string]: config.media_folder as string }
		}
	: null;

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
	VITE_CMS_BASE_URL
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
const pages = [
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

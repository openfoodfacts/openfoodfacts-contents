<script lang="ts">
	import CMS from '@sveltia/cms';
	import { config, pages, previewApiUrl } from '../../lib/cms-config';
	import { createPreviewTemplate } from '../../lib/preview/preview-template';

	// Initialize the CMS with the typed, env-driven configuration.
	// load_config_file: false is set in the config object itself,
	// so Sveltia does not fetch a config.yml from the static folder.
	CMS.init({ config });

	// Register the remote-rendering preview template, but only when a preview API URL is
	// configured. Without it the CMS keeps its built-in preview unchanged. Sveltia looks up a
	// template by the file name of the entry being edited (before the collection name), so the
	// same component is registered once per page. See `docs/explain-rendering.md`.
	if (previewApiUrl) {
		const RemotePreview = createPreviewTemplate(previewApiUrl);

		for (const { name } of pages) {
			CMS.registerPreviewTemplate(name, RemotePreview);
		}
	}
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<title>Sveltia CMS</title>
</svelte:head>

<!-- Mount point for the CMS single-page application. -->
<div id="nc-root"></div>

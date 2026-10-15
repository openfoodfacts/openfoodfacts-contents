<script lang="ts">
	import CMS from '@sveltia/cms';
	import { config } from '../../lib/cms-config';

	// Initialize the CMS with the typed, env-driven configuration.
	// load_config_file: false is set in the config object itself,
	// so Sveltia does not fetch a config.yml from the static folder.
	CMS.init({ config });
</script>

<svelte:head>
	<meta name="robots" content="noindex" />
	<title>Sveltia CMS</title>
</svelte:head>

<!-- Mount point for the CMS single-page application. -->
<div id="nc-root"></div>

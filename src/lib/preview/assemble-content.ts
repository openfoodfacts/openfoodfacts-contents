import { dump as yamlDump } from 'js-yaml';

import { markdownBodyFieldName } from '../cms-config';

/**
 * Reassemble the full Markdown file Sveltia will commit, from the entry draft's field values:
 * YAML frontmatter built from every field except the Markdown-body field, followed by the body
 * field's value as Markdown. This mirrors what is stored in `content/{{locale}}/{{name}}.md` so the
 * preview API renders the exact bytes the live site would.
 *
 * Adding a frontmatter field to the collection config flows through automatically, as long as it is
 * not a `markdown` widget: only the field whose widget is `markdown` is treated as the body and
 * written below the frontmatter. See `docs/explain-rendering.md`.
 */
export const assembleContent = (data: Record<string, unknown>): string => {
	const frontmatter: Record<string, unknown> = {};
	let body = '';

	for (const [key, value] of Object.entries(data)) {
		if (key === markdownBodyFieldName) {
			body = typeof value === 'string' ? value : '';
		} else if (value !== undefined) {
			frontmatter[key] = value;
		}
	}

	const yamlDumpResult = Object.keys(frontmatter).length === 0 ? '' : yamlDump(frontmatter);

	// YAML frontmatter is wrapped in `---` fences; the body follows a blank line, the way Decap and
	// Sveltia write files on disk.
	return `---\n${yamlDumpResult}---\n\n${body}`;
};

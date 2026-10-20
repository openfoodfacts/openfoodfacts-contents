import type { AssetsContext, EntryView } from './types';
import { githubAssetContext } from '../cms-config';

/**
 * Prefix shared by every Editorial Workflow branch name, matching Decap/Netlify CMS so drafts
 * created by either CMS are interchangeable. See Sveltia's `getBranchName` in
 * `src/lib/services/workflow/branch.js`.
 */
const WORKFLOW_BRANCH_PREFIX = 'cms';

/**
 * Build the asset-resolution context for a preview request. Returns `null` on the `test-repo`
 * backend (no GitHub repository for the server to read from) and when the GitHub repo/branch are
 * not configured.
 *
 * `branches` lists the draft branch first when the entry has a slug, then the published branch, so
 * the server can resolve media committed to an Editorial Workflow draft before falling back to
 * `main`. The draft branch name is computed from the entry's collection and slug using the
 * Decap-compatible `cms/{collection}/{slug}` convention, which is the only Sveltia-specific
 * knowledge this relies on (a documented, stable convention rather than an internal API).
 */
export const buildAssetsContext = (entry: EntryView): AssetsContext | null => {
	if (!githubAssetContext) {
		return null;
	}

	const { repo, mainBranch, pathMap } = githubAssetContext;
	const collection = entry.get('collection') as string | undefined;
	const slug = entry.get('slug') as string | undefined;

	const branches: string[] = [];

	if (collection && slug) {
		branches.push(`${WORKFLOW_BRANCH_PREFIX}/${collection}/${slug}`);
	}

	branches.push(mainBranch);

	return { repo, branches, pathMap };
};

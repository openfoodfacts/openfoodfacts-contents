/**
 * Shared types for the remote preview integration.
 * See `docs/explain-rendering.md` for the full design.
 */

/**
 * Asset-resolution context sent with a preview request so the remote API can rewrite media
 * references (e.g. `/uploads/foo.png`) to GitHub raw URLs. The server tries `branches` in order
 * (draft first, then the published branch) so images committed to an Editorial Workflow draft
 * branch resolve before falling back to `main`.
 *
 * Omitted entirely on the `test-repo` backend, where no GitHub repository exists for the server
 * to read from; only inlined `data:` URLs can render images there.
 */
export type AssetsContext = {
	repo: string;
	branches: string[];
	pathMap: Record<string, string>;
};

/**
 * Request body posted to the `VITE_PREVIEW_API_URL` endpoint. `content` is the full Markdown file
 * reassembled from the entry draft (YAML frontmatter + body), matching what Git will store. The
 * server parses the frontmatter and renders the page as it would on the live site.
 */
export type PreviewRequestBody = {
	content: string;
	assets_context?: AssetsContext;
};

/**
 * Lifecycle state of a single preview render.
 * - `idle`: a successful render is showing (or nothing yet, before the first render).
 * - `loading`: a request is in flight.
 * - `error`: the last request failed; the previous render (if any) is still showing.
 */
export type PreviewStatus = 'idle' | 'loading' | 'error';

/**
 * Minimal view of Sveltia's Immutable entry Map as received by a custom preview template. We only
 * read a few top-level keys, so the full `ApiEntry` shape is not pulled in here to avoid coupling
 * the preview logic to Sveltia's internals beyond the documented props.
 */
export type EntryView = {
	get(key: string): unknown;
};

/**
 * Minimal view of the `getAsset(path)` prop received by a custom preview template. See Sveltia's
 * `ApiAsset` type. We use `toBase64` to inline just-uploaded (unsaved) images as `data:` URLs.
 */
export type AssetView = {
	path: string;
	url: string;
	fileObj?: File | null;
	toBase64?: () => Promise<string>;
};

export type GetAssetProp = (path: string, field?: unknown) => AssetView | undefined;

import type { GetAssetProp } from './types';

/**
 * Match `blob:` URLs that Sveltia inserts into the editor for files uploaded but not yet saved
 * (see Sveltia's `UnsavedAssetProxy`, keyed by blob URL in `getAsset`). Saved images are
 * referenced by their public path instead and are left for the server to resolve.
 */
const BLOB_URL_PATTERN = /blob:[^)\s"'<>]+/g;

/**
 * MIME type of a `File`, falling back to a sniff by extension. Used to build a `data:` URL.
 */
const getMimeType = (file: File): string => file.type || 'application/octet-stream';

/**
 * Inline every `blob:` URL in a single string value as a `data:` URL, by reading the unsaved file
 * behind it through `getAsset`. Values that contain no `blob:` URL are returned unchanged, and any
 * asset that cannot be resolved is left as is so the rest of the value still renders.
 */
const inlineInString = async (value: string, getAsset: GetAssetProp): Promise<string> => {
	const matches = [...value.matchAll(BLOB_URL_PATTERN)].map((m) => m[0]);

	if (matches.length === 0) {
		return value;
	}

	let result = value;

	// Resolve sequentially to keep the regex replacements ordered
	for (const blobUrl of matches) {
		const asset = getAsset(blobUrl);

		if (!asset?.fileObj || typeof asset.toBase64 !== 'function') {
			continue;
		}

		try {
			const base64 = await asset.toBase64();
			const dataUrl = `data:${getMimeType(asset.fileObj)};base64,${base64}`;
			result = result.split(blobUrl).join(dataUrl);
		} catch {
			// Leave the blob URL in place if the bytes can't be read
		}
	}

	return result;
};

/**
 * Walk the entry `data` and return a shallow copy in which every `blob:` URL — in the Markdown body
 * or in any frontmatter string value — has been replaced by a `data:` URL carrying the file's
 * bytes. Non-string values are passed through untouched (lists/objects recurse via `JSON.stringify`
 * fallback below only for strings nested in structures our flat field values don't produce).
 *
 * This is what lets an editor see a freshly uploaded image in the preview before the entry is
 * saved, since the remote API has no way to fetch a file that only exists in the browser.
 */
export const inlineUnsavedAssets = async (
	data: Record<string, unknown>,
	getAsset: GetAssetProp
): Promise<Record<string, unknown>> => {
	const out: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(data)) {
		if (typeof value === 'string') {
			out[key] = await inlineInString(value, getAsset);
		} else {
			out[key] = value;
		}
	}

	return out;
};

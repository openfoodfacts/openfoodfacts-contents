import type { AssetsContext, PreviewRequestBody } from './types';

/**
 * POST the reassembled Markdown `content` to the remote rendering API and return the full HTML
 * document it produces. `previewApiUrl` is the full endpoint URL (e.g.
 * `https://beta.openfoodfacts.net/contents/preview`), called directly from the browser (the API is
 * expected to send CORS headers, including a response to the `OPTIONS` preflight triggered by
 * `Content-Type: application/json`).
 *
 * `signal` allows the caller to abort an in-flight request when a newer edit supersedes it; the
 * resulting `AbortError` should be treated as cancellation rather than failure.
 *
 * @throws {Error} On a network failure or a non-2xx response, with a short message suitable to
 * show in the preview's error banner.
 */
export const fetchPreviewHtml = async (
	previewApiUrl: string,
	content: string,
	assetsContext: AssetsContext | null,
	signal: AbortSignal
): Promise<string> => {
	const body: PreviewRequestBody = { content };

	if (assetsContext) {
		body.assets_context = assetsContext;
	}

	let response: Response;

	try {
		response = await fetch(previewApiUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal
		});
	} catch (error) {
		if ((error as Error)?.name === 'AbortError') {
			throw error;
		}

		throw new Error('Network error while contacting the preview API.', { cause: error });
	}

	if (!response.ok) {
		throw new Error(`Preview API responded with ${response.status} ${response.statusText}.`);
	}

	return response.text();
};

/**
 * This module exports a factory function that creates
 * a React component for the Sveltia CMS entry preview.
 * The component fetches a live render of the entry from a remote API
 * and displays it in a sandboxed iframe, with debounced updates and error handling.
 *
 * The factory function takes the preview API URL as an argument,
 * so the component can be reused for different pages
 * without prop-drilling the config into React state.
 *
 * See `docs/explain-rendering.md` for the full design of the remote preview integration.
 */

import CMS from '@sveltia/cms';

import { assembleContent } from './assemble-content';
import { buildAssetsContext } from './assets-context';
import { fetchPreviewHtml } from './fetch-preview';
import { inlineUnsavedAssets } from './inline-assets';
import type { GetAssetProp, PreviewStatus } from './types';

/**
 * Debounce delay (ms) before a preview request is sent after the entry stops changing. Keeps a
 * typed draft from hammering the remote API on every keystroke.
 */
const DEBOUNCE_MS = 400;

const { createElement: h, useState, useEffect, useRef } = CMS.React;

/**
 * A minimal view of the props Sveltia passes to a custom preview template. Only the entry and
 * `getAsset` are used; the rest (`widgetFor`, `widgetsFor`, `getCollection`, the iframe `document`
 * and `window`) are ignored because the rendering is delegated to the remote API.
 */
type PreviewProps = {
	entry: {
		get(key: string): unknown;
	};
	getAsset: GetAssetProp;
};

/**
 * Read the current locale's field values from the entry Map as a plain object. Sveltia wraps the
 * entry in an Immutable Map, so `data` is read via `get('data')` and unwrapped with `toJS`. This is
 * defensive about the shape in case a future Sveltia version hands the values over directly.
 */
const readEntryData = (entry: PreviewProps['entry']): Record<string, unknown> => {
	const data = entry.get('data') as
		{ toJS?: () => Record<string, unknown> } | Record<string, unknown> | undefined;

	if (data && typeof data.toJS === 'function') {
		return data.toJS();
	}

	return (data as Record<string, unknown>) ?? {};
};

const containerStyle: Record<string, string> = {
	position: 'relative',
	width: '100%',
	height: '100%',
	display: 'flex',
	flexDirection: 'column'
};

const iframeStyle: Record<string, string> = {
	flex: '1 1 auto',
	width: '100%',
	border: 'none',
	minHeight: '0'
};

const overlayBase: Record<string, string> = {
	position: 'absolute',
	left: '50%',
	transform: 'translateX(-50%)',
	bottom: '1rem',
	padding: '0.4rem 0.75rem',
	borderRadius: '0.375rem',
	fontSize: '0.875rem',
	fontFamily: 'system-ui, sans-serif',
	boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
	pointerEvents: 'none',
	zIndex: '2'
};

const spinnerStyle: Record<string, string> = {
	...overlayBase,
	background: 'rgba(0,0,0,0.6)',
	color: '#fff'
};

const errorStyle: Record<string, string> = {
	...overlayBase,
	background: '#fee2e2',
	color: '#b91c1c',
	border: '1px solid #fca5a5'
};

/**
 * Create a custom preview template bound to a specific preview API URL. The URL is captured in the
 * closure so the component is reused for every page without prop-drilling config into React state.
 *
 * The template is a thin React shell: all the real logic (assembling the Markdown, inlining unsaved
 * images, building the asset context, debouncing, caching and fetching) lives in plain TypeScript
 * modules. The shell only owns the React state and the sandboxed `<iframe srcdoc>` that displays
 * the rendered page.
 *
 * The iframe is sandboxed with `allow-scripts` only (no `allow-same-origin`), so the rendered HTML
 * — which comes from user-authored Markdown — runs in an opaque origin and cannot reach the CMS or
 * its GitHub token. See `docs/explain-rendering.md`.
 */
export const createPreviewTemplate = (previewApiUrl: string) => {
	const PreviewTemplate = (props: PreviewProps) => {
		const { entry, getAsset } = props;

		const [html, setHtml] = useState('');
		const [status, setStatus] = useState<PreviewStatus>('loading');
		const [error, setError] = useState<string | undefined>();

		const cacheRef = useRef<Map<string, string>>(new Map());
		const abortRef = useRef<AbortController | undefined>(undefined);

		// Re-render whenever the entry or asset resolver changes (Sveltia passes fresh instances on
		// every keystroke), debounced so rapid edits collapse into a single request.
		useEffect(() => {
			let cancelled = false;

			const timer = setTimeout(async () => {
				const inlined = await inlineUnsavedAssets(readEntryData(entry), getAsset);

				if (cancelled) {
					return;
				}

				const content = assembleContent(inlined);
				const assetsContext = buildAssetsContext(entry);
				const cacheKey = JSON.stringify({ content, assetsContext });

				const cached = cacheRef.current.get(cacheKey);

				if (cached !== undefined) {
					setHtml(cached);
					setStatus('idle');
					setError(undefined);
					return;
				}

				abortRef.current?.abort();

				const controller = new AbortController();
				abortRef.current = controller;

				setStatus('loading');

				try {
					const rendered = await fetchPreviewHtml(
						previewApiUrl,
						content,
						assetsContext,
						controller.signal
					);

					if (cancelled || controller.signal.aborted) {
						return;
					}

					cacheRef.current.set(cacheKey, rendered);
					setHtml(rendered);
					setStatus('idle');
					setError(undefined);
				} catch (e) {
					if (cancelled || (e as Error)?.name === 'AbortError') {
						return;
					}

					setStatus('error');
					setError((e as Error)?.message ?? 'Unknown error');
				}
			}, DEBOUNCE_MS);

			return () => {
				cancelled = true;
				clearTimeout(timer);
			};
		}, [entry, getAsset]);

		const showSpinner = status === 'loading';
		const showError = status === 'error';

		return h('div', { style: containerStyle }, [
			h('iframe', {
				key: 'iframe',
				srcDoc: html,
				title: 'Page preview',
				sandbox: 'allow-scripts',
				style: iframeStyle
			}),
			showSpinner ? h('div', { key: 'spinner', style: spinnerStyle }, 'Updating…') : null,
			showError
				? h(
						'div',
						{ key: 'error', style: errorStyle },
						`Preview failed: ${error ?? 'unknown error'}`
					)
				: null
		]);
	};

	return PreviewTemplate;
};

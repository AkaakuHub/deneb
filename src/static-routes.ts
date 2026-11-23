import { Hono } from 'hono';
import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { ServerConfig } from './config.ts';
import { serveFileResponse } from './storage/serve-file.ts';
import { createStaticResolver } from './storage/static-resolver.ts';
import { createWebviewApiRoutes } from './webview-api/webview-api-routes.ts';
import { createWebviewApiStore } from './webview-api/webview-api-store.ts';
import { serveWebviewDocument } from './webview-document/serve-webview-document.ts';
import { createWebviewDocumentStore } from './webview-document/webview-document-store.ts';
import { isWebviewPagePath } from './webview-page-path.ts';
import { serveWebviewShell } from './webview-shell/serve-webview-shell.ts';

export function createStaticRoutes(config: ServerConfig): Hono {
	const app = new Hono();
	const resolver = createStaticResolver(config);
	const webviewApiStore = createWebviewApiStore(join(config.root, 'api-data'));
	const webviewDocumentStore = createWebviewDocumentStore(config.root);

	app.post('/api/radio_form', async (c) => {
		const formData = await c.req.formData();
		const submissionPath = join(
			config.root,
			'contact',
			'radio_mail_submissions.jsonl',
		);
		mkdirSync(dirname(submissionPath), { recursive: true });
		appendFileSync(
			submissionPath,
			`${JSON.stringify({
				received_at: new Date().toISOString(),
				fields: serializeFormData(formData),
			})}\n`,
		);
		return c.json({ message: 'ok' });
	});

	app.route('/api', createWebviewApiRoutes(webviewApiStore));

	app.get('*', async (c) => {
		const requestUrl = new URL(c.req.url);
		const document = webviewDocumentStore.resolve(requestUrl.pathname);
		if (document) {
			return serveWebviewDocument(c.req.raw, document);
		}
		if (isWebviewPagePath(requestUrl.pathname)) {
			const shell = resolver.resolve(new URL('/index.html', requestUrl));
			return shell ? serveWebviewShell(c.req.raw, shell) : c.notFound();
		}
		const file = resolver.resolve(requestUrl);
		return file ? serveFileResponse(c.req.raw, file) : c.notFound();
	});

	app.on('HEAD', '*', async (c) => {
		const requestUrl = new URL(c.req.url);
		const document = webviewDocumentStore.resolve(requestUrl.pathname);
		if (document) {
			return serveWebviewDocument(c.req.raw, document);
		}
		if (isWebviewPagePath(requestUrl.pathname)) {
			const shell = resolver.resolve(new URL('/index.html', requestUrl));
			return shell ? serveWebviewShell(c.req.raw, shell) : c.notFound();
		}
		const file = resolver.resolve(requestUrl);
		return file ? serveFileResponse(c.req.raw, file) : c.notFound();
	});

	return app;
}

function serializeFormData(formData: FormData): Record<string, string[]> {
	const fields: Record<string, string[]> = {};
	for (const [key, value] of formData.entries()) {
		fields[key] = [...(fields[key] ?? []), value];
	}
	return fields;
}

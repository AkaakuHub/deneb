import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import type { ServerConfig } from '../../src/config.ts';
import { createStaticRoutes } from '../../src/static-routes.ts';

describe('WebView document delivery', () => {
	test('renders stored content at the official path without a client bundle', async () => {
		const root = mkdtempSync(join(tmpdir(), 'webview-data-'));
		mkdirSync(join(root, 'legal'), { recursive: true });
		mkdirSync(join(root, 'styles'), { recursive: true });
		writeFileSync(
			join(root, 'webview-documents.json'),
			JSON.stringify({
				stylesheet: 'styles/webview.css',
				documents: {
					'/legal/terms': {
						title: '利用規約',
						file: 'legal/terms',
						sha256: 'a'.repeat(64),
					},
				},
			}),
		);
		writeFileSync(
			join(root, 'legal', 'terms'),
			'<div class="terms"><article><h1>利用規約</h1></article></div>\n',
		);
		writeFileSync(
			join(root, 'styles', 'webview.css'),
			'h1 { display: none; }\n',
		);
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request('/legal/terms?in=webview');
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(html).toContain('<title>利用規約</title>');
		expect(html).toContain('<h1>利用規約</h1>');
		expect(html).toContain(
			'<style type="text/css">\nh1 { display: none; }\n</style>',
		);
		expect(html).not.toContain('<link rel="stylesheet"');
		expect(html).not.toContain('client.mjs');
		expect(html).not.toContain('<script');
	});
});

function createTestConfig(root: string): ServerConfig {
	return {
		root,
		host: '0.0.0.0',
		port: 8081,
	};
}

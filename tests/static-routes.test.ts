import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import type { ServerConfig } from '../src/config.ts';
import { createStaticRoutes } from '../src/static-routes.ts';

function createTestConfig(root: string): ServerConfig {
	return {
		root,
		host: '0.0.0.0',
		port: 8081,
	};
}

describe('createStaticRoutes', () => {
	test('does not fabricate an unstored school idol connect theme list', async () => {
		const app = createStaticRoutes(createTestConfig('/oracle/top'));
		const response = await app.request(
			'/api/school_idol_connect_post/theme_list',
		);

		expect(response.status).toBe(404);
	});

	test('serves stored WebView gacha detail API without header metadata', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		mkdirSync(join(root, 'api-data', 'gacha-detail'), { recursive: true });
		writeFileSync(
			join(root, 'api-data', 'gacha-detail', '1055003.json'),
			JSON.stringify({ title: 'DREAM INTERLUDE COLLECTION', rates: [] }),
		);
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request(
			'/api/gacha/detail?gacha_series_id=1055003',
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			title: 'DREAM INTERLUDE COLLECTION',
			rates: [],
		});
	});

	test('serves stored WebView select card list API', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		mkdirSync(join(root, 'api-data', 'select-card-list'), { recursive: true });
		writeFileSync(
			join(root, 'api-data', 'select-card-list', '1020003.json'),
			JSON.stringify({
				select_ticket_list: [
					{
						exchange_ticket_name: 'ticket',
						cards: [{ rarity: 'SR', name: 'card', description: 'member' }],
					},
				],
			}),
		);
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request(
			'/api/gacha/select_card_list?select_ticket_series_id=1020003',
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			select_ticket_list: [
				{
					exchange_ticket_name: 'ticket',
					cards: [{ rarity: 'SR', name: 'card', description: 'member' }],
				},
			],
		});
	});

	test('replays a stored official select card list error', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		mkdirSync(join(root, 'api-data', 'errors'), { recursive: true });
		writeFileSync(
			join(root, 'api-data', 'select-card-list-errors.json'),
			JSON.stringify({
				'4030007': { status: 500, error: '00002_380202' },
			}),
		);
		writeFileSync(
			join(root, 'api-data', 'errors', '00002_380202.json'),
			JSON.stringify({
				error_code: '00002_380202',
				title: 'サーバーエラー',
			}),
		);
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request(
			'/api/gacha/select_card_list?select_ticket_series_id=4030007',
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error_code: '00002_380202',
			title: 'サーバーエラー',
		});
	});

	test('records radio form submissions and returns official ok body', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		const app = createStaticRoutes(createTestConfig(root));
		const body = new FormData();
		body.set('category', 'radio_1032');
		body.set('name', 'test');
		body.set('message', 'hello');

		const response = await app.request('/api/radio_form', {
			method: 'POST',
			body,
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ message: 'ok' });

		const saved = readFileSync(
			join(root, 'contact', 'radio_mail_submissions.jsonl'),
			'utf8',
		);
		const record = JSON.parse(saved) as {
			fields: Record<string, string[]>;
		};
		expect(record.fields).toEqual({
			category: ['radio_1032'],
			name: ['test'],
			message: ['hello'],
		});
	});

	test('keeps direct contact POST unsupported', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		mkdirSync(join(root, 'contact'));
		writeFileSync(join(root, 'contact', 'radio_mail'), '');
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request('/contact/radio_mail', {
			method: 'POST',
			body: new FormData(),
		});

		expect(response.status).toBe(404);
	});

	test('does not fetch or save an unstored top page', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request('/');

		expect(response.status).toBe(404);
	});

	test('serves the common shell for stored WebView page routes', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		writeFileSync(join(root, 'index.html'), '<html>WebView</html>');
		const app = createStaticRoutes(createTestConfig(root));

		for (const path of [
			'/legal/terms',
			'/news/android?in=webview',
			'/explain/provided_gacha/1050510?in=webview',
			'/explain/provided_gacha_list/2/4030007',
		]) {
			const response = await app.request(path);
			expect(response.status).toBe(200);
			expect(await response.text()).toBe('<html>WebView</html>');
		}
	});

	test('restores the WebView session from application request headers', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		writeFileSync(
			join(root, 'index.html'),
			'<html><head></head><body><div id="root"></div></body></html>',
		);
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request('/explain/provided_gacha/1050510', {
			headers: {
				authorization: 'Bearer saved-session',
				'x-client-version': '5.1.0',
				'x-llll-id': '12345&"',
			},
		});

		expect(response.status).toBe(200);
		expect(response.headers.get('set-cookie')).toBe(
			`session=${encodeURIComponent(
				JSON.stringify({
					authorization: 'Bearer saved-session',
					'x-client-version': '5.1.0',
					'x-llll-id': '12345&"',
				}),
			)}; Path=/; SameSite=Lax`,
		);
		expect(await response.text()).toContain(
			'<meta id="x-llll-id" content="12345&amp;&quot;" />',
		);
	});

	test('does not create a WebView session without application headers', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		writeFileSync(join(root, 'index.html'), '<html><head></head></html>');
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request('/explain/provided_gacha/1050510');

		expect(response.headers.get('set-cookie')).toBeNull();
		expect(await response.text()).toBe('<html><head></head></html>');
	});

	test('does not serve the common shell for an unknown path', async () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		writeFileSync(join(root, 'index.html'), '<html>WebView</html>');
		const app = createStaticRoutes(createTestConfig(root));

		const response = await app.request('/missing');

		expect(response.status).toBe(404);
	});
});

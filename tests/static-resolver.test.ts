import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import type { ServerConfig } from '../src/config.ts';
import { createStaticResolver } from '../src/storage/static-resolver.ts';

describe('createStaticResolver', () => {
	test('rejects traversal paths', () => {
		const config: ServerConfig = {
			root: '/oracle/top',
			host: '0.0.0.0',
			port: 8081,
		};
		const resolver = createStaticResolver(config);

		expect(
			resolver.resolveStoragePath(
				new URL('https://selfhost.example/..%2fetc/passwd'),
			),
		).toBeUndefined();
	});

	test('resolves top web static files', () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		mkdirSync(join(root, 'explain'));
		mkdirSync(join(root, 'explain', 'provided_gacha'));
		mkdirSync(join(root, 'contact'));
		mkdirSync(join(root, 'images'));
		mkdirSync(join(root, 'legal'));
		mkdirSync(join(root, 'news'));
		writeFileSync(join(root, 'client.mjs'), '');
		writeFileSync(join(root, 'contact', 'radio_mail'), '');
		writeFileSync(join(root, 'explain', 'provided_gacha', '1055003'), '');
		writeFileSync(join(root, 'help'), '');
		writeFileSync(join(root, 'images', 'favicon.png'), '');
		writeFileSync(join(root, 'legal', 'credits'), '');
		writeFileSync(join(root, 'news', 'android'), '');

		const resolver = createStaticResolver({
			root,
			host: '0.0.0.0',
			port: 8081,
		});

		expect(
			resolver.resolve(new URL('https://selfhost.example/client.mjs')),
		).toBe(join(root, 'client.mjs'));
		expect(
			resolver.resolve(new URL('https://selfhost.example/contact/radio_mail')),
		).toBe(join(root, 'contact', 'radio_mail'));
		expect(resolver.resolve(new URL('https://selfhost.example/help'))).toBe(
			join(root, 'help'),
		);
		expect(
			resolver.resolve(
				new URL('https://selfhost.example/explain/provided_gacha/1055003'),
			),
		).toBe(join(root, 'explain', 'provided_gacha', '1055003'));
		expect(
			resolver.resolve(
				new URL(
					'https://selfhost.example/explain/provided_gacha/1055003?in=webview',
				),
			),
		).toBe(join(root, 'explain', 'provided_gacha', '1055003'));
		expect(
			resolver.resolve(new URL('https://selfhost.example/legal/credits')),
		).toBe(join(root, 'legal', 'credits'));
		expect(
			resolver.resolve(new URL('https://selfhost.example/images/favicon.png')),
		).toBe(join(root, 'images', 'favicon.png'));
	});

	test('stores query API responses separately', () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		mkdirSync(join(root, 'api', 'gacha'), { recursive: true });
		const search = '?gacha_series_id=1050511';
		const fileName = `detail.query-${createHash('sha256').update(search).digest('hex')}.json`;
		writeFileSync(join(root, 'api', 'gacha', fileName), '{}');

		const resolver = createStaticResolver({
			root,
			host: '0.0.0.0',
			port: 8081,
		});

		expect(
			resolver.resolve(
				new URL(
					'https://selfhost.example/api/gacha/detail?gacha_series_id=1050511',
				),
			),
		).toBe(join(root, 'api', 'gacha', fileName));
	});
});

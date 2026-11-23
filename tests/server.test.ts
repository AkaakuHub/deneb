import { expect, test } from 'bun:test';
import { createApp } from '../src/server.ts';
import type { ServerConfig } from '../src/config.ts';

const config: ServerConfig = {
	root: '/data',
	host: '127.0.0.1',
	port: 8081,
};

test('health reports the deneb service identity', async () => {
	const response = await createApp(config).request('/health');
	expect(response.status).toBe(200);
	expect(await response.json()).toEqual({
		ok: true,
		service: 'deneb',
		role: 'top',
	});
});

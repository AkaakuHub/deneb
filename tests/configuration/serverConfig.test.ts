import { expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { loadConfig } from '../../src/config.ts';

const environment = {
	DATA_ROOT: tmpdir(),
	HOST: 'localhost',
	PORT: '1',
};

test('requires explicit storage and listen settings', () => {
	for (const key of Object.keys(environment)) {
		const missing: NodeJS.ProcessEnv = { ...environment };
		delete missing[key];
		expect(() => loadConfig(missing)).toThrow();
	}
});

test('uses the supplied configuration without machine defaults', () => {
	const config = loadConfig(environment);
	expect(config.root).toBe(environment.DATA_ROOT);
	expect(config.host).toBe(environment.HOST);
	expect(config.port).toBe(Number(environment.PORT));
});

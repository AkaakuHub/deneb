import { serve } from 'bun';
import { loadConfig } from './config.ts';
import { createApp } from './server.ts';

const config = loadConfig();
const app = createApp(config);

serve({
	hostname: config.host,
	port: config.port,
	fetch: app.fetch,
});

console.log(`deneb listening on http://${config.host}:${String(config.port)}`);

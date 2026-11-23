import { Hono } from 'hono';
import type { ServerConfig } from './config.ts';
import { createStaticRoutes } from './static-routes.ts';

export function createApp(config: ServerConfig): Hono {
	const app = new Hono();

	app.get('/health', (c) =>
		c.json({
			ok: true,
			service: 'deneb',
			role: 'top',
		}),
	);

	app.route('/', createStaticRoutes(config));

	app.notFound((c) =>
		c.json(
			{
				error: 'not_found',
				path: new URL(c.req.url).pathname,
			},
			404,
		),
	);

	return app;
}

import { Hono } from 'hono';
import type { WebviewApiStore } from './webview-api-store.ts';

export function createWebviewApiRoutes(store: WebviewApiStore): Hono {
	const app = new Hono();

	app.get('/extra/news.json', () =>
		storedResponse('/api/extra/news.json', store.readExtraNews()),
	);
	app.get('/weblive/id', () =>
		storedResponse('/api/weblive/id', store.readWebliveId()),
	);
	app.get('/school_idol_connect_post/theme_list', () =>
		storedResponse(
			'/api/school_idol_connect_post/theme_list',
			store.readSchoolIdolConnectPostThemeList(),
		),
	);

	app.get('/gacha/detail', (c) => {
		const id = c.req.query('gacha_series_id') ?? '';
		const payload = store.readGachaDetail(id);
		if (payload === undefined) {
			return localNotFound(
				`No local gacha/detail data for gacha_series_id=${id || '(empty)'}`,
			);
		}
		return jsonResponse(200, payload);
	});

	app.get('/gacha/select_card_list', (c) => {
		const id = c.req.query('select_ticket_series_id') ?? '';
		const response = store.readSelectCardList(id);
		if (response === undefined) {
			return localNotFound(
				`No local select_card_list data for select_ticket_series_id=${id || '(empty)'}`,
			);
		}
		return jsonResponse(response.status, response.payload);
	});

	app.get('/shop/membership_perk_detail', (c) => {
		const id = c.req.query('membership_id') ?? '';
		const payload = store.readMembershipPerkDetail(id);
		if (payload === undefined) {
			return localNotFound(
				`No local membership_perk_detail data for membership_id=${id || '(empty)'}`,
			);
		}
		return jsonResponse(200, payload);
	});

	app.post('/contact', () => localWriteBlocked('/api/contact'));
	app.post('/serial_code', () => localWriteBlocked('/api/serial_code'));

	app.all('*', (c) =>
		localNotFound(`Local WebView API route is not stored: ${c.req.path}`),
	);

	return app;
}

function storedResponse(path: string, payload: unknown | undefined): Response {
	return payload === undefined
		? localNotFound(`No local WebView API data for ${path}`)
		: jsonResponse(200, payload);
}

function jsonResponse(status: number, payload: unknown): Response {
	const body = JSON.stringify(payload, null, 2);
	return new Response(body, {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Content-Length': String(Buffer.byteLength(body)),
		},
	});
}

function localNotFound(message: string): Response {
	return jsonResponse(404, {
		error_code: 'LOCAL_NOT_FOUND',
		title: 'Local WebView API Not Found',
		message,
	});
}

function localWriteBlocked(path: string): Response {
	return jsonResponse(501, {
		error_code: 'LOCAL_WRITE_BLOCKED',
		title: 'Local WebView API Write Blocked',
		message: `Blocked local write endpoint: ${path}`,
	});
}

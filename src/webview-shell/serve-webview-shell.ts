import { readFileSync } from 'node:fs';

const sessionHeaderNames = [
	'authorization',
	'x-device-specific-id',
	'x-device-type',
	'x-client-version',
	'x-res-version',
	'inspix-user-api-version',
	'x-api-key',
	'x-llll-id',
] as const;

export function serveWebviewShell(
	request: Request,
	filePath: string,
): Response {
	const source = readFileSync(filePath, 'utf8');
	const playerId = request.headers.get('x-llll-id');
	const body = playerId ? injectPlayerId(source, playerId) : source;
	const headers = new Headers({
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'text/html; charset=utf-8',
	});
	const session = createSessionHeaders(request.headers);
	if (Object.keys(session).length > 0) {
		headers.set(
			'Set-Cookie',
			`session=${encodeURIComponent(JSON.stringify(session))}; Path=/; SameSite=Lax`,
		);
	}

	if (request.method === 'HEAD') {
		headers.set('Content-Length', String(Buffer.byteLength(body)));
		return new Response(null, { status: 200, headers });
	}

	return new Response(body, { status: 200, headers });
}

function createSessionHeaders(headers: Headers): Record<string, string> {
	const session: Record<string, string> = {};
	for (const name of sessionHeaderNames) {
		const value = headers.get(name);
		if (value) {
			session[name] = value;
		}
	}
	return session;
}

function injectPlayerId(source: string, playerId: string): string {
	const meta = `<meta id="x-llll-id" content="${escapeAttribute(playerId)}" />`;
	return source.replace('</head>', `\t\t${meta}\n\t</head>`);
}

function escapeAttribute(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('"', '&quot;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

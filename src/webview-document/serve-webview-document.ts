import type { WebviewDocument } from './webview-document-store.ts';

export async function serveWebviewDocument(
	request: Request,
	document: WebviewDocument,
): Promise<Response> {
	const contentFile = Bun.file(document.contentPath);
	const stylesheetFile = Bun.file(document.stylesheetPath);
	if (!(await contentFile.exists()) || !(await stylesheetFile.exists())) {
		return new Response('Not Found', { status: 404 });
	}
	const body = renderDocument(
		document.title,
		await stylesheetFile.text(),
		await contentFile.text(),
	);
	const headers = new Headers({
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'text/html; charset=utf-8',
		'Content-Length': String(Buffer.byteLength(body)),
	});
	return new Response(request.method === 'HEAD' ? null : body, { headers });
}

function renderDocument(
	title: string,
	stylesheet: string,
	content: string,
): string {
	return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1,minimum-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>${escapeHtml(title)}</title>
<style type="text/css">
${stylesheet.trim()}
</style>
</head>
<body>
${content.trim()}
</body>
</html>
`;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

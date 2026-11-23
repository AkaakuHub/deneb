import { statSync } from 'node:fs';
import { extname } from 'node:path';

const rangePattern = /^bytes=(\d*)-(\d*)$/;

export function serveFileResponse(
	request: Request,
	filePath: string,
): Response {
	const file = Bun.file(filePath);
	const stat = statSync(filePath);
	const range = parseRange(request.headers.get('range'), stat.size);
	const headers = new Headers({
		'Accept-Ranges': 'bytes',
		'Access-Control-Allow-Origin': '*',
		'Content-Type': detectContentType(filePath, file.type),
	});

	if (request.method === 'HEAD') {
		headers.set('Content-Length', String(stat.size));
		return new Response(null, { status: 200, headers });
	}

	if (!range) {
		headers.set('Content-Length', String(stat.size));
		return new Response(file, { status: 200, headers });
	}

	const [start, end] = range;
	headers.set('Content-Length', String(end - start + 1));
	headers.set(
		'Content-Range',
		`bytes ${String(start)}-${String(end)}/${String(stat.size)}`,
	);
	return new Response(file.slice(start, end + 1), { status: 206, headers });
}

function detectContentType(filePath: string, bunContentType: string): string {
	const extension = extname(filePath).toLowerCase();
	if (extension === '' || extension === '.html' || extension === '.htm') {
		return 'text/html; charset=utf-8';
	}
	if (bunContentType && bunContentType !== 'application/octet-stream') {
		return bunContentType;
	}
	return 'application/octet-stream';
}

function parseRange(
	rangeHeader: string | null,
	fileSize: number,
): [number, number] | undefined {
	if (!rangeHeader) {
		return undefined;
	}
	const match = rangePattern.exec(rangeHeader.trim());
	if (!match) {
		return undefined;
	}

	const startText = match[1] ?? '';
	const endText = match[2] ?? '';
	if (!startText && !endText) {
		return undefined;
	}

	const start = startText
		? Number(startText)
		: Math.max(0, fileSize - Number(endText));
	const end = endText && startText ? Number(endText) : fileSize - 1;
	if (
		!Number.isSafeInteger(start) ||
		!Number.isSafeInteger(end) ||
		start >= fileSize ||
		start > end
	) {
		return undefined;
	}
	return [start, Math.min(end, fileSize - 1)];
}

import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const manifestSchema = z.object({
	stylesheet: z.string().min(1),
	documents: z.record(
		z.string(),
		z.object({
			title: z.string(),
			file: z.string().min(1),
			sha256: z.string().regex(/^[a-f0-9]{64}$/),
		}),
	),
});

export type WebviewDocument = {
	title: string;
	contentPath: string;
	stylesheetPath: string;
};

type WebviewDocumentStore = {
	resolve(pathname: string): WebviewDocument | undefined;
};

export function createWebviewDocumentStore(root: string): WebviewDocumentStore {
	const manifestPath = resolve(root, 'webview-documents.json');
	const stat = statSync(manifestPath, { throwIfNoEntry: false });
	if (!stat?.isFile()) {
		return { resolve: () => undefined };
	}
	const manifest = manifestSchema.parse(
		JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown,
	);
	return {
		resolve(pathname: string): WebviewDocument | undefined {
			const document = manifest.documents[pathname];
			if (!document) {
				return undefined;
			}
			return {
				title: document.title,
				contentPath: resolveStoredPath(root, document.file),
				stylesheetPath: resolveStoredPath(root, manifest.stylesheet),
			};
		},
	};
}

function resolveStoredPath(root: string, relativePath: string): string {
	const rootPath = resolve(root);
	const filePath = resolve(rootPath, relativePath);
	if (!filePath.startsWith(`${rootPath}/`)) {
		throw new Error(`WebView document path escapes root: ${relativePath}`);
	}
	return filePath;
}

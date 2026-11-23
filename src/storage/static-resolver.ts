import { statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { normalize, resolve } from 'node:path';
import type { ServerConfig } from '../config.ts';

type StaticResolver = {
	resolve(requestUrl: URL): string | undefined;
	resolveStoragePath(requestUrl: URL): string | undefined;
};

export function createStaticResolver(config: ServerConfig): StaticResolver {
	return {
		resolve(requestUrl: URL): string | undefined {
			const filePath = this.resolveStoragePath(requestUrl);
			return filePath ? existingFile(filePath) : undefined;
		},
		resolveStoragePath(requestUrl: URL): string | undefined {
			const path = decodeURIComponent(requestUrl.pathname);
			return safeJoinPath(
				config.root,
				createStorageRelativePath(path, requestUrl),
			);
		},
	};
}

function createStorageRelativePath(path: string, requestUrl: URL): string {
	const relativePath = path.replace(/^\/+/, '');
	if (!requestUrl.search || !path.startsWith('/api/')) {
		return relativePath;
	}

	return `${relativePath}.query-${hashSearch(requestUrl.search)}.json`;
}

function hashSearch(search: string): string {
	return createHash('sha256').update(search).digest('hex');
}

function safeJoinPath(root: string, relativePath: string): string | undefined {
	const rootPath = resolve(root);
	const filePath = resolve(rootPath, normalize(relativePath));
	if (!filePath.startsWith(`${rootPath}/`) && filePath !== rootPath) {
		return undefined;
	}
	return filePath;
}

function existingFile(path: string): string | undefined {
	const stat = statSync(path, { throwIfNoEntry: false });
	if (!stat?.isFile()) {
		return undefined;
	}
	return path;
}

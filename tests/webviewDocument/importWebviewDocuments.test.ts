import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { importWebviewDocuments } from '../../src/webview-document/import-webview-documents.ts';

describe('importWebviewDocuments', () => {
	test('stores static body data and one stylesheet without embedded source maps', () => {
		const sourceRoot = mkdtempSync(join(tmpdir(), 'webview-source-'));
		const outRoot = mkdtempSync(join(tmpdir(), 'webview-data-'));
		for (const source of [
			'page/legal/copyright/copyright.tsx',
			'page/legal/credits/credits.tsx',
			'page/legal/privacy/privacy.tsx',
			'page/legal/law/settlement/settlement.tsx',
			'page/legal/law/transaction/transaction.tsx',
			'page/legal/law/transaction/transaction_ios.tsx',
			'page/legal/law/transaction/transaction_android.tsx',
			'page/legal/terms/terms.tsx',
		]) {
			const rootTag = source.includes('/settlement/') ? 'body' : 'div';
			writeFixture(
				join(sourceRoot, source),
				`export const Page = () => (<${rootTag} className="legal"><Helmet><title>利用規約</title><style>{css}</style></Helmet><article><h1>本文</h1><p>{'　'}内容</p></article></${rootTag}>);`,
			);
		}
		writeFixture(
			join(sourceRoot, 'asset/scss/style.scss'),
			'export default `body { color: #333; }\n/*# sourceMappingURL=data:application/json;base64,abc */`;',
		);

		const manifest = importWebviewDocuments({ sourceRoot, outRoot });

		expect(Object.keys(manifest.documents)).toHaveLength(8);
		const terms = readFileSync(join(outRoot, 'legal/terms'), 'utf8');
		expect(terms).toContain('<div class="legal">');
		expect(terms).toContain('<h1>本文</h1>');
		expect(terms).toContain('　内容');
		expect(terms).not.toContain('Helmet');
		expect(terms).not.toContain('<style');
		const css = readFileSync(join(outRoot, 'styles/webview.css'), 'utf8');
		expect(css).toBe('body { color: #333; }\n');
		expect(css).not.toContain('sourceMappingURL');
	});
});

function writeFixture(filePath: string, content: string): void {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content);
}

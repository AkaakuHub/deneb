import { importWebviewDocuments } from '../src/webview-document/import-webview-documents.ts';

const args = new Map<string, string>();
for (let index = 2; index < process.argv.length; index += 1) {
	const key = process.argv[index];
	const value = process.argv[index + 1];
	if (key?.startsWith('--') && value && !value.startsWith('--')) {
		args.set(key.slice(2), value);
		index += 1;
	}
}

function requiredArg(name: string): string {
	const value = args.get(name);
	if (!value) {
		throw new Error(`Missing required argument: --${name}`);
	}
	return value;
}

const manifest = importWebviewDocuments({
	sourceRoot: requiredArg('source-root'),
	outRoot: requiredArg('out-root'),
});
console.log(
	`Imported WebView documents: ${String(Object.keys(manifest.documents).length)}`,
);

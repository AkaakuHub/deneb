import { writeImportedWebviewApiData } from '../src/webview-api/import-webview-api-content.ts';

type CliArgs = {
	[name: string]: string | undefined;
};

function parseArgs(argv: string[]): CliArgs {
	const args: CliArgs = {};
	for (let index = 2; index < argv.length; index += 1) {
		const current = argv[index];
		if (!current?.startsWith('--')) {
			continue;
		}
		const key = current.slice(2);
		const next = argv[index + 1];
		if (next && !next.startsWith('--')) {
			args[key] = next;
			index += 1;
		} else {
			args[key] = 'true';
		}
	}
	return args;
}

function requiredArg(args: CliArgs, name: string): string {
	const value = args[name];
	if (!value || value === 'true') {
		throw new Error(`Missing required argument: --${name}`);
	}
	return value;
}

const args = parseArgs(process.argv);
const importOptions = {
	apiContentDir: requiredArg(args, 'api-content-dir'),
	outRoot: requiredArg(args, 'out-root'),
};
const summary = writeImportedWebviewApiData(importOptions);

console.log(`Imported WebView API data: ${summary.outRoot}`);
console.log(
	`Counts: gachaDetail=${String(summary.counts.gachaDetail)}, ` +
		`membershipPerkDetail=${String(summary.counts.membershipPerkDetail)}, ` +
		`selectCardList=${String(summary.counts.selectCardList)}, ` +
		`selectCardListErrors=${String(summary.counts.selectCardListErrors)}, ` +
		`singleton=${String(summary.counts.singleton)}`,
);

import { writeReconstructedSelectCardLists } from '../src/webview-api/reconstruct-select-card-list.ts';

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
const summary = writeReconstructedSelectCardLists({
	masterdataDir: requiredArg(args, 'masterdata-dir'),
	outRoot: requiredArg(args, 'out-root'),
});

console.log(`Reconstructed select card lists: ${summary.outRoot}`);
console.log(`Count: ${String(summary.count)}`);

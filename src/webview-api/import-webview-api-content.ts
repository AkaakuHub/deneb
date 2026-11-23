import {
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';

type ImportOptions = {
	apiContentDir: string;
	outRoot: string;
};

type ImportCounts = {
	gachaDetail: number;
	membershipPerkDetail: number;
	selectCardList: number;
	selectCardListErrors: number;
	singleton: number;
};

type ImportSummary = {
	generatedAt: string;
	apiContentDir: string;
	outRoot: string;
	counts: ImportCounts;
};

type RoutePayloads = {
	gachaDetailById: Record<string, unknown>;
	membershipPerkDetailById: Record<string, unknown>;
	selectCardListById: Record<string, unknown>;
	selectCardListErrorById: Record<string, { status: number; error: string }>;
	errorPayloadById: Record<string, unknown>;
	singleton: Record<string, unknown>;
};

function collectWebviewApiContent(options: ImportOptions): RoutePayloads {
	const responsesDir = join(options.apiContentDir, 'responses');
	assertDirectory(responsesDir);

	const routePayloads: RoutePayloads = {
		gachaDetailById: {},
		membershipPerkDetailById: {},
		selectCardListById: {},
		selectCardListErrorById: {},
		errorPayloadById: {},
		singleton: {},
	};

	for (const name of readdirSync(responsesDir)) {
		const filePath = join(responsesDir, name);
		if (!statSync(filePath).isFile() || !name.endsWith('.json')) {
			continue;
		}

		const payload = readJson(filePath);
		const gachaDetailId = matchId(
			name,
			/^api_gacha_detail_gacha_series_id_(\d+)\.json$/,
		);
		if (gachaDetailId) {
			routePayloads.gachaDetailById[gachaDetailId] = payload;
			continue;
		}

		const membershipId = matchId(
			name,
			/^api_shop_membership_perk_detail_membership_id_(\d+)\.json$/,
		);
		if (membershipId) {
			routePayloads.membershipPerkDetailById[membershipId] = payload;
			continue;
		}

		const selectCardListId = matchId(
			name,
			/^api_gacha_select_card_list_select_ticket_series_id_(\d+)\.json$/,
		);
		if (selectCardListId && isSelectCardListPayload(payload)) {
			routePayloads.selectCardListById[selectCardListId] = payload;
			continue;
		}

		const singletonName = singletonOutputName(name);
		if (singletonName) {
			routePayloads.singleton[singletonName] = payload;
		}
	}
	collectFailedSelectCardListResponses(options.apiContentDir, routePayloads);

	return routePayloads;
}

export function writeImportedWebviewApiData(
	options: ImportOptions,
	now = new Date(),
): ImportSummary {
	const routePayloads = collectWebviewApiContent(options);

	writeRecordFiles(
		join(options.outRoot, 'gacha-detail'),
		routePayloads.gachaDetailById,
	);
	writeRecordFiles(
		join(options.outRoot, 'membership-perk-detail'),
		routePayloads.membershipPerkDetailById,
	);
	writeRecordFiles(
		join(options.outRoot, 'select-card-list'),
		routePayloads.selectCardListById,
	);
	writeRecordFiles(
		join(options.outRoot, 'errors'),
		routePayloads.errorPayloadById,
	);
	if (Object.keys(routePayloads.selectCardListErrorById).length > 0) {
		writeJson(
			join(options.outRoot, 'select-card-list-errors.json'),
			routePayloads.selectCardListErrorById,
		);
	}
	writeRecordFiles(join(options.outRoot, 'singleton'), routePayloads.singleton);

	const summary: ImportSummary = {
		generatedAt: now.toISOString(),
		apiContentDir: resolve(options.apiContentDir),
		outRoot: resolve(options.outRoot),
		counts: {
			gachaDetail: Object.keys(routePayloads.gachaDetailById).length,
			membershipPerkDetail: Object.keys(routePayloads.membershipPerkDetailById)
				.length,
			selectCardList: Object.keys(routePayloads.selectCardListById).length,
			selectCardListErrors: Object.keys(routePayloads.selectCardListErrorById)
				.length,
			singleton: Object.keys(routePayloads.singleton).length,
		},
	};
	return summary;
}

function collectFailedSelectCardListResponses(
	apiContentDir: string,
	routePayloads: RoutePayloads,
): void {
	const reportPath = join(apiContentDir, 'api-fetch-report.json');
	const report = readJson(reportPath);
	if (!Array.isArray(report)) {
		throw new Error(`Invalid API fetch report: ${reportPath}`);
	}
	for (const record of report) {
		if (
			!isRecord(record) ||
			record.ok !== false ||
			record.status === undefined
		) {
			continue;
		}
		if (
			typeof record.url !== 'string' ||
			typeof record.outputFile !== 'string'
		) {
			throw new Error(`Invalid failed API record: ${reportPath}`);
		}
		const url = new URL(record.url);
		if (url.pathname !== '/api/gacha/select_card_list') {
			continue;
		}
		const id = url.searchParams.get('select_ticket_series_id');
		if (!id || !/^\d+$/.test(id)) {
			throw new Error(`Invalid select ticket series ID: ${record.url}`);
		}
		if (typeof record.status !== 'number') {
			throw new Error(`Invalid API status: ${record.url}`);
		}
		const payload = readJson(
			join(
				apiContentDir,
				'responses',
				record.outputFile.split('/').at(-1) ?? '',
			),
		);
		const error = errorPayloadId(payload);
		routePayloads.errorPayloadById[error] = payload;
		routePayloads.selectCardListErrorById[id] = {
			status: record.status,
			error,
		};
	}
}

function errorPayloadId(payload: unknown): string {
	if (
		isRecord(payload) &&
		typeof payload.error_code === 'string' &&
		/^[a-zA-Z0-9_-]+$/.test(payload.error_code)
	) {
		return payload.error_code;
	}
	return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function matchId(name: string, pattern: RegExp): string | undefined {
	return pattern.exec(name)?.[1];
}

function singletonOutputName(responseFileName: string): string | undefined {
	if (responseFileName === 'api_extra_news.json') {
		return 'extra-news';
	}
	if (responseFileName === 'api_weblive_id.json') {
		return 'weblive-id';
	}
	if (responseFileName === 'api_school_idol_connect_post_theme_list.json') {
		return 'school-idol-connect-post-theme-list';
	}
	return undefined;
}

function isSelectCardListPayload(value: unknown): boolean {
	return isRecord(value) && Array.isArray(value.select_ticket_list);
}

function writeRecordFiles(
	outDir: string,
	records: Record<string, unknown>,
): void {
	for (const [id, payload] of Object.entries(records)) {
		writeJson(join(outDir, `${id}.json`), payload);
	}
}

function readJson(filePath: string): unknown {
	return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function writeJson(filePath: string, payload: unknown): void {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function assertDirectory(dirPath: string): void {
	const stat = statSync(dirPath, { throwIfNoEntry: false });
	if (!stat?.isDirectory()) {
		throw new Error(`Directory not found: ${dirPath}`);
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

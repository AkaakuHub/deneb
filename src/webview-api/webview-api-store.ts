import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type WebviewApiStore = {
	readGachaDetail(gachaSeriesId: string): unknown | undefined;
	readSelectCardList(
		selectTicketSeriesId: string,
	): StoredWebviewApiResponse | undefined;
	readMembershipPerkDetail(membershipId: string): unknown | undefined;
	readExtraNews(): unknown | undefined;
	readWebliveId(): unknown | undefined;
	readSchoolIdolConnectPostThemeList(): unknown | undefined;
};

export type StoredWebviewApiResponse = {
	status: number;
	payload: unknown;
};

export function createWebviewApiStore(root: string): WebviewApiStore {
	return {
		readGachaDetail(gachaSeriesId: string): unknown | undefined {
			return readJson(join(root, 'gacha-detail', `${gachaSeriesId}.json`));
		},
		readSelectCardList(
			selectTicketSeriesId: string,
		): StoredWebviewApiResponse | undefined {
			const payload = readJson(
				join(root, 'select-card-list', `${selectTicketSeriesId}.json`),
			);
			if (payload !== undefined) {
				return { status: 200, payload };
			}
			const errors = readJson(join(root, 'select-card-list-errors.json'));
			if (!isRecord(errors)) {
				return undefined;
			}
			const storedError = errors[selectTicketSeriesId];
			if (
				!isRecord(storedError) ||
				typeof storedError.status !== 'number' ||
				typeof storedError.error !== 'string'
			) {
				return undefined;
			}
			const errorPayload = readJson(
				join(root, 'errors', `${storedError.error}.json`),
			);
			return errorPayload === undefined
				? undefined
				: { status: storedError.status, payload: errorPayload };
		},
		readMembershipPerkDetail(membershipId: string): unknown | undefined {
			return readJson(
				join(root, 'membership-perk-detail', `${membershipId}.json`),
			);
		},
		readExtraNews(): unknown {
			return readJson(join(root, 'singleton', 'extra-news.json'));
		},
		readWebliveId(): unknown {
			return readJson(join(root, 'singleton', 'weblive-id.json'));
		},
		readSchoolIdolConnectPostThemeList(): unknown {
			return readJson(
				join(root, 'singleton', 'school-idol-connect-post-theme-list.json'),
			);
		},
	};
}

function readJson(filePath: string): unknown | undefined {
	const stat = statSync(filePath, { throwIfNoEntry: false });
	if (!stat?.isFile()) {
		return undefined;
	}
	return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import { writeImportedWebviewApiData } from '../src/webview-api/import-webview-api-content.ts';

function writeJson(filePath: string, payload: unknown): void {
	writeFileSync(filePath, JSON.stringify(payload), 'utf8');
}

describe('writeImportedWebviewApiData', () => {
	test('imports WebView API responses into route keyed files', () => {
		const root = mkdtempSync(join(tmpdir(), 'deneb-'));
		const apiContentDir = join(root, 'api-content');
		const responsesDir = join(apiContentDir, 'responses');
		const outRoot = join(root, 'api-data');
		mkdirSync(responsesDir, { recursive: true });

		writeJson(
			join(responsesDir, 'api_gacha_detail_gacha_series_id_1055003.json'),
			{
				title: 'gacha',
			},
		);
		writeJson(
			join(
				responsesDir,
				'api_shop_membership_perk_detail_membership_id_3001.json',
			),
			{ name: 'membership' },
		);
		writeJson(join(responsesDir, 'api_extra_news.json'), []);
		writeJson(
			join(
				responsesDir,
				'api_gacha_select_card_list_select_ticket_series_id_4030007.json',
			),
			{
				error_code: '00002_380202',
				title: 'サーバーエラー',
			},
		);
		writeJson(join(apiContentDir, 'api-fetch-report.json'), [
			{
				url: 'https://example.test/api/gacha/select_card_list?select_ticket_series_id=4030007',
				status: 500,
				ok: false,
				outputFile:
					'responses/api_gacha_select_card_list_select_ticket_series_id_4030007.json',
			},
		]);

		const summary = writeImportedWebviewApiData(
			{
				apiContentDir,
				outRoot,
			},
			new Date('2026-06-28T07:30:00.000Z'),
		);

		expect(summary.counts).toEqual({
			gachaDetail: 1,
			membershipPerkDetail: 1,
			selectCardList: 0,
			selectCardListErrors: 1,
			singleton: 1,
		});
		expect(
			JSON.parse(
				readFileSync(join(outRoot, 'gacha-detail', '1055003.json'), 'utf8'),
			),
		).toEqual({ title: 'gacha' });
		expect(
			JSON.parse(
				readFileSync(join(outRoot, 'select-card-list-errors.json'), 'utf8'),
			),
		).toEqual({
			'4030007': { status: 500, error: '00002_380202' },
		});
		expect(
			JSON.parse(
				readFileSync(join(outRoot, 'errors', '00002_380202.json'), 'utf8'),
			),
		).toEqual({
			error_code: '00002_380202',
			title: 'サーバーエラー',
		});
	});
});

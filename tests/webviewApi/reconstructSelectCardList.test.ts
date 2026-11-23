import { describe, expect, test } from 'bun:test';
import {
	createSelectCardListProvenance,
	reconstructSelectCardLists,
} from '../../src/webview-api/reconstruct-select-card-list.ts';

describe('reconstructSelectCardLists', () => {
	test('masterdataからAPI互換のセレクトチケット一覧を再構成する', () => {
		const reconstructed = reconstructSelectCardLists({
			selectTicketSeries: [
				{ Id: 4030001, ExchangeTicketName: 'URセレクトチケット' },
			],
			selectTicketExchangeRates: [
				{
					SelectTicketSeriesId: 4030001,
					ExchangeItemType: 2,
					ExchangeItemId: 10315010,
				},
				{
					SelectTicketSeriesId: 4030001,
					ExchangeItemType: 2,
					ExchangeItemId: 10315011,
				},
			],
			cards: [
				{
					Id: 10315010,
					Rarity: 5,
					Name: 'Dream Believers',
					Description: '日野下花帆',
				},
				{
					Id: 10315011,
					Rarity: 5,
					Name: 'Dream Believers',
					Description: '日野下花帆',
				},
			],
			cardRarities: [{ Id: 5, RarityName: 'UR' }],
		});

		expect(reconstructed).toEqual({
			'4030001': {
				select_ticket_list: [
					{
						exchange_ticket_name: 'URセレクトチケット',
						cards: [
							{
								rarity: 'UR',
								name: 'Dream Believers',
								description: '日野下花帆',
							},
						],
					},
				],
			},
		});
	});

	test('公式エラーIDと一致する全生成物へ再構成元を記録する', () => {
		const reconstructed = {
			'4030001': {
				select_ticket_list: [
					{
						exchange_ticket_name: 'URセレクトチケット',
						cards: [],
					},
				],
			},
		};
		const provenance = createSelectCardListProvenance(reconstructed, {
			'4030001': { status: 500, error: '00002_380202' },
		});

		expect(provenance).toMatchObject({
			classification: 'reconstructed',
			official_fetch: {
				status: 500,
				error_code: '00002_380202',
			},
			entries: {
				'4030001': 'select-card-list/4030001.json',
			},
		});
	});
});

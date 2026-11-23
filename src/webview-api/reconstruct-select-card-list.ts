import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

type DataRecord = Record<string, unknown>;

type ReconstructedCard = {
	rarity: string;
	name: string;
	description: string;
};

type ReconstructedSelectCardList = {
	select_ticket_list: Array<{
		exchange_ticket_name: string;
		cards: ReconstructedCard[];
	}>;
};

type SelectCardListMasterdata = {
	selectTicketSeries: DataRecord[];
	selectTicketExchangeRates: DataRecord[];
	cards: DataRecord[];
	cardRarities: DataRecord[];
};

type SelectCardListReconstructionSummary = {
	outRoot: string;
	count: number;
};

const sourceFiles = [
	'SelectTicketSeries.yaml',
	'SelectTicketExchangeRate.yaml',
	'CardDatas.yaml',
	'CardRarities.yaml',
] as const;

export function reconstructSelectCardLists(
	masterdata: SelectCardListMasterdata,
): Record<string, ReconstructedSelectCardList> {
	const rarityById = new Map(
		masterdata.cardRarities.map((row) => [
			requiredText(row, 'Id'),
			requiredText(row, 'RarityName'),
		]),
	);
	const cardById = new Map(
		masterdata.cards.map((row) => {
			const rarityId = requiredText(row, 'Rarity');
			const rarity = rarityById.get(rarityId);
			if (!rarity) {
				throw new Error(`Card rarity not found: ${rarityId}`);
			}
			return [
				requiredText(row, 'Id'),
				{
					rarity,
					name: requiredText(row, 'Name'),
					description: requiredText(row, 'Description'),
				},
			] as const;
		}),
	);
	const cardIdsBySeriesId = new Map<string, string[]>();
	for (const row of masterdata.selectTicketExchangeRates) {
		if (requiredNumber(row, 'ExchangeItemType') !== 2) {
			continue;
		}
		const seriesId = requiredText(row, 'SelectTicketSeriesId');
		const cardIds = cardIdsBySeriesId.get(seriesId) ?? [];
		cardIds.push(requiredText(row, 'ExchangeItemId'));
		cardIdsBySeriesId.set(seriesId, cardIds);
	}

	const result: Record<string, ReconstructedSelectCardList> = {};
	for (const row of masterdata.selectTicketSeries) {
		const seriesId = requiredText(row, 'Id');
		const cardIds = cardIdsBySeriesId.get(seriesId);
		if (!cardIds) {
			throw new Error(`Select ticket exchange rates not found: ${seriesId}`);
		}
		const cards: ReconstructedCard[] = [];
		const cardKeys = new Set<string>();
		for (const cardId of cardIds) {
			const card = cardById.get(cardId);
			if (!card) {
				throw new Error(`Select ticket card not found: ${cardId}`);
			}
			const cardKey = `${card.rarity}\u0000${card.name}\u0000${card.description}`;
			if (!cardKeys.has(cardKey)) {
				cardKeys.add(cardKey);
				cards.push(card);
			}
		}
		if (cards.length === 0) {
			throw new Error(`Select ticket cards are empty: ${seriesId}`);
		}
		result[seriesId] = {
			select_ticket_list: [
				{
					exchange_ticket_name: requiredText(row, 'ExchangeTicketName'),
					cards,
				},
			],
		};
	}
	return result;
}

export function createSelectCardListProvenance(
	reconstructed: Record<string, ReconstructedSelectCardList>,
	officialErrors: unknown,
): DataRecord {
	const errorRecords = requiredRecords(
		officialErrors,
		'select-card-list-errors',
	);
	const reconstructedIds = Object.keys(reconstructed).sort(compareIds);
	const errorIds = Object.keys(errorRecords).sort(compareIds);
	if (JSON.stringify(reconstructedIds) !== JSON.stringify(errorIds)) {
		throw new Error('Reconstructed IDs do not match official error IDs');
	}
	for (const id of errorIds) {
		const error = errorRecords[id];
		if (
			!isRecord(error) ||
			error.status !== 500 ||
			error.error !== '00002_380202'
		) {
			throw new Error(`Unexpected official error record: ${id}`);
		}
	}
	return {
		schema_version: 1,
		dataset: 'select-card-list',
		classification: 'reconstructed',
		notice:
			'公式APIがHTTP 500を返したため、保存済みmasterdataから再構成したデータです。公式APIの成功responseではありません。',
		official_fetch: {
			status: 500,
			error_code: '00002_380202',
			record: 'select-card-list-errors.json',
		},
		sources: sourceFiles,
		limitations: [
			'公式APIの成功responseを取得できていないため、field値と並び順の完全一致は未確認です。',
			'保存済みmembership_perk_detailの16件とは、rarity表現と人物名の空白を正規化したカード集合が一致します。',
		],
		entries: Object.fromEntries(
			reconstructedIds.map((id) => [id, `select-card-list/${id}.json`]),
		),
	};
}

export function writeReconstructedSelectCardLists(options: {
	masterdataDir: string;
	outRoot: string;
}): SelectCardListReconstructionSummary {
	const masterdata = readMasterdata(options.masterdataDir);
	const reconstructed = reconstructSelectCardLists(masterdata);
	const officialErrors = readJson(
		join(options.outRoot, 'select-card-list-errors.json'),
	);
	const provenance = createSelectCardListProvenance(
		reconstructed,
		officialErrors,
	);
	const outputDirectory = join(options.outRoot, 'select-card-list');
	rmSync(outputDirectory, { recursive: true, force: true });
	mkdirSync(outputDirectory, { recursive: true });
	for (const [id, payload] of Object.entries(reconstructed)) {
		writeJson(join(outputDirectory, `${id}.json`), payload);
	}
	writeJson(
		join(options.outRoot, 'select-card-list-provenance.json'),
		provenance,
	);
	return {
		outRoot: resolve(options.outRoot),
		count: Object.keys(reconstructed).length,
	};
}

function readMasterdata(masterdataDir: string): SelectCardListMasterdata {
	return {
		selectTicketSeries: readYamlRecords(
			join(masterdataDir, 'SelectTicketSeries.yaml'),
		),
		selectTicketExchangeRates: readYamlRecords(
			join(masterdataDir, 'SelectTicketExchangeRate.yaml'),
		),
		cards: readYamlRecords(join(masterdataDir, 'CardDatas.yaml')),
		cardRarities: readYamlRecords(join(masterdataDir, 'CardRarities.yaml')),
	};
}

function readYamlRecords(filePath: string): DataRecord[] {
	const parsed: unknown = Bun.YAML.parse(readFileSync(filePath, 'utf8'));
	if (!Array.isArray(parsed) || !parsed.every(isRecord)) {
		throw new Error(`Invalid masterdata YAML: ${filePath}`);
	}
	return parsed;
}

function readJson(filePath: string): unknown {
	return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
}

function writeJson(filePath: string, value: unknown): void {
	writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function requiredText(record: DataRecord, key: string): string {
	const value = record[key];
	if (typeof value !== 'string' && typeof value !== 'number') {
		throw new Error(`Invalid ${key}`);
	}
	const text = String(value).trim();
	if (!text) {
		throw new Error(`Empty ${key}`);
	}
	return text;
}

function requiredNumber(record: DataRecord, key: string): number {
	const value = record[key];
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		throw new Error(`Invalid ${key}`);
	}
	return value;
}

function requiredRecords(value: unknown, name: string): DataRecord {
	if (!isRecord(value)) {
		throw new Error(`Invalid ${name}`);
	}
	return value;
}

function isRecord(value: unknown): value is DataRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compareIds(left: string, right: string): number {
	return Number(left) - Number(right);
}

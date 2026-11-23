const exactWebviewPagePaths = new Set([
	'/serial_code/form',
	'/serial_code/form/complete',
	'/news',
	'/news/ios',
	'/news/android',
	'/faq',
	'/help',
	'/contact',
	'/contact/complete',
	'/legal/copyright',
	'/legal/credits',
	'/legal/privacy',
	'/legal/law/settlement',
	'/legal/law/transaction',
	'/legal/law/transaction_ios',
	'/legal/law/transaction_android',
	'/legal/terms',
	'/explain/archive',
	'/explain/play_pt',
	'/explain/present_count',
	'/app/store',
	'/app_store',
	'/contact/radio_mail',
	'/contact/radio_complete',
	'/live',
]);

const dynamicWebviewPagePatterns = [
	/^\/news\/[^/]+$/,
	/^\/explain\/membership\/(?:ios|android)\/[^/]+$/,
	/^\/explain\/provided_gacha\/[^/]+$/,
	/^\/explain\/provided_gacha_list\/[^/]+\/[^/]+$/,
];

export function isWebviewPagePath(pathname: string): boolean {
	return (
		exactWebviewPagePaths.has(pathname) ||
		dynamicWebviewPagePatterns.some((pattern) => pattern.test(pathname))
	);
}

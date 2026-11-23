import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';

type ImportWebviewDocumentsOptions = {
	sourceRoot: string;
	outRoot: string;
};

type WebviewDocumentManifest = {
	stylesheet: string;
	documents: Record<
		string,
		{
			title: string;
			file: string;
			sha256: string;
		}
	>;
};

const legalDocuments = [
	{
		route: '/legal/copyright',
		source: 'page/legal/copyright/copyright.tsx',
	},
	{
		route: '/legal/credits',
		source: 'page/legal/credits/credits.tsx',
	},
	{
		route: '/legal/privacy',
		source: 'page/legal/privacy/privacy.tsx',
	},
	{
		route: '/legal/law/settlement',
		source: 'page/legal/law/settlement/settlement.tsx',
	},
	{
		route: '/legal/law/transaction',
		source: 'page/legal/law/transaction/transaction.tsx',
	},
	{
		route: '/legal/law/transaction_ios',
		source: 'page/legal/law/transaction/transaction_ios.tsx',
	},
	{
		route: '/legal/law/transaction_android',
		source: 'page/legal/law/transaction/transaction_android.tsx',
	},
	{
		route: '/legal/terms',
		source: 'page/legal/terms/terms.tsx',
	},
] as const;

export function importWebviewDocuments(
	options: ImportWebviewDocumentsOptions,
): WebviewDocumentManifest {
	const documents: WebviewDocumentManifest['documents'] = {};
	for (const document of legalDocuments) {
		const sourcePath = join(options.sourceRoot, document.source);
		const sourceText = readFileSync(sourcePath, 'utf8');
		const extracted = extractStaticDocument(sourcePath, sourceText);
		const relativeFile = document.route.replace(/^\//, '');
		writeText(join(options.outRoot, relativeFile), `${extracted.body}\n`);
		documents[document.route] = {
			title: extracted.title,
			file: relativeFile,
			sha256: createHash('sha256').update(extracted.body).digest('hex'),
		};
	}

	const stylesheet = 'styles/webview.css';
	const stylesheetSource = readFileSync(
		join(options.sourceRoot, 'asset/scss/style.scss'),
		'utf8',
	);
	writeText(
		join(options.outRoot, stylesheet),
		`${extractStylesheet(stylesheetSource)}\n`,
	);

	const manifest = { stylesheet, documents };
	writeText(
		join(options.outRoot, 'webview-documents.json'),
		`${JSON.stringify(manifest, null, 2)}\n`,
	);
	return manifest;
}

function extractStaticDocument(
	filePath: string,
	sourceText: string,
): { title: string; body: string } {
	const sourceFile = ts.createSourceFile(
		filePath,
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TSX,
	);
	const titleElement = findJsxElement(sourceFile, 'title');
	const bodyElement =
		findJsxElement(sourceFile, 'div') ?? findJsxElement(sourceFile, 'body');
	if (!titleElement || !bodyElement) {
		throw new Error(`Static document structure not found: ${filePath}`);
	}
	return {
		title: serializeJsxChildren(titleElement.children, sourceFile).trim(),
		body: serializeJsxElement(bodyElement, sourceFile),
	};
}

function findJsxElement(
	root: ts.Node,
	tagName: string,
): ts.JsxElement | undefined {
	let result: ts.JsxElement | undefined;
	const visit = (node: ts.Node): void => {
		if (result) {
			return;
		}
		if (
			ts.isJsxElement(node) &&
			node.openingElement.tagName.getText() === tagName
		) {
			result = node;
			return;
		}
		ts.forEachChild(node, visit);
	};
	visit(root);
	return result;
}

function serializeJsxElement(
	element: ts.JsxElement,
	sourceFile: ts.SourceFile,
): string {
	const sourceTagName = element.openingElement.tagName.getText(sourceFile);
	const tagName = sourceTagName === 'body' ? 'div' : sourceTagName;
	if (tagName === 'Helmet') {
		return '';
	}
	const attributes = serializeJsxAttributes(
		element.openingElement.attributes,
		sourceFile,
	);
	return `<${tagName}${attributes}>${serializeJsxChildren(element.children, sourceFile)}</${tagName}>`;
}

function serializeJsxChildren(
	children: ts.NodeArray<ts.JsxChild>,
	sourceFile: ts.SourceFile,
): string {
	return children.map((child) => serializeJsxChild(child, sourceFile)).join('');
}

function serializeJsxChild(
	child: ts.JsxChild,
	sourceFile: ts.SourceFile,
): string {
	if (ts.isJsxText(child)) {
		return child.getText(sourceFile);
	}
	if (ts.isJsxElement(child)) {
		return serializeJsxElement(child, sourceFile);
	}
	if (ts.isJsxSelfClosingElement(child)) {
		const tagName = child.tagName.getText(sourceFile);
		return `<${tagName}${serializeJsxAttributes(child.attributes, sourceFile)} />`;
	}
	if (ts.isJsxExpression(child)) {
		if (!child.expression) {
			return '';
		}
		if (
			ts.isStringLiteral(child.expression) ||
			ts.isNoSubstitutionTemplateLiteral(child.expression)
		) {
			return escapeHtml(child.expression.text);
		}
		throw new Error(
			`Unsupported JSX expression in ${sourceFile.fileName}: ${child.expression.getText(sourceFile)}`,
		);
	}
	throw new Error(
		`Unsupported JSX node in ${sourceFile.fileName}: ${child.getText(sourceFile)}`,
	);
}

function serializeJsxAttributes(
	attributes: ts.JsxAttributes,
	sourceFile: ts.SourceFile,
): string {
	return attributes.properties
		.map((property) => {
			if (!ts.isJsxAttribute(property)) {
				throw new Error(
					`Unsupported JSX spread attribute in ${sourceFile.fileName}`,
				);
			}
			if (!ts.isIdentifier(property.name)) {
				throw new Error(
					`Unsupported JSX attribute name in ${sourceFile.fileName}`,
				);
			}
			const name =
				property.name.text === 'className' ? 'class' : property.name.text;
			if (!property.initializer) {
				return ` ${name}`;
			}
			if (ts.isStringLiteral(property.initializer)) {
				return ` ${name}="${escapeAttribute(property.initializer.text)}"`;
			}
			if (
				ts.isJsxExpression(property.initializer) &&
				property.initializer.expression &&
				ts.isStringLiteral(property.initializer.expression)
			) {
				return ` ${name}="${escapeAttribute(property.initializer.expression.text)}"`;
			}
			throw new Error(
				`Unsupported JSX attribute in ${sourceFile.fileName}: ${property.getText(sourceFile)}`,
			);
		})
		.join('');
}

function extractStylesheet(sourceText: string): string {
	const sourceFile = ts.createSourceFile(
		'style.scss',
		sourceText,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS,
	);
	const exportAssignment = sourceFile.statements.find(ts.isExportAssignment);
	if (
		!exportAssignment ||
		!ts.isNoSubstitutionTemplateLiteral(exportAssignment.expression)
	) {
		throw new Error('Static stylesheet export not found');
	}
	return exportAssignment.expression.text
		.replace(/\/\*# sourceMappingURL=data:[\s\S]*?\*\//, '')
		.trim();
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;');
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replaceAll('"', '&quot;');
}

function writeText(filePath: string, content: string): void {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, content, 'utf8');
}

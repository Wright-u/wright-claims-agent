import fs from 'node:fs';
import type { CoreClient, CoreTool, ToolCallResult } from './types.js';

interface FixtureSymbol {
	id: string; // "<file path>#<Parent>.<Name>"
	kind: string;
	signature?: string;
	code?: string;
	calledBy?: string[];
}
interface FixtureFile {
	path: string;
	symbols: FixtureSymbol[];
}
interface Fixture {
	containers: Record<string, { files: FixtureFile[] }>;
}

const MOCK_TOOLS: CoreTool[] = [
	{
		name: 'getApplicationStructure',
		description:
			'Lists the files and declared symbols in an application. Start here. Each signature has a canonical symbolPath for symbol tools; use readSymbolCode only when canReadCode is true.',
		inputSchema: {
			type: 'object',
			properties: {
				appName: {
					type: 'string',
					description: 'Application name.',
				},
			},
			required: ['appName'],
		},
	},
	{
		name: 'readSymbolCode',
		description:
			'Reads the implementation of a declared symbol. Use filePath and symbolPath exactly as returned by getApplicationStructure, and only when canReadCode is true.',
		inputSchema: {
			type: 'object',
			properties: {
				appName: { type: 'string', description: 'Application name.' },
				filePath: {
					type: 'string',
					description: 'A file path returned by getApplicationStructure.',
				},
				symbolPath: {
					type: 'array',
					items: { type: 'string' },
					description: 'Ordered names from the file root to the declared symbol.',
				},
			},
			required: ['appName', 'filePath', 'symbolPath'],
		},
	},
	{
		name: 'findSymbolReferences',
		description:
			'Finds declarations in the application that reference a declared symbol. Use filePath and symbolPath exactly as returned by getApplicationStructure.',
		inputSchema: {
			type: 'object',
			properties: {
				appName: { type: 'string', description: 'Application name.' },
				filePath: {
					type: 'string',
					description: 'A file path returned by getApplicationStructure.',
				},
				symbolPath: {
					type: 'array',
					items: { type: 'string' },
					description: 'Ordered names from the file root to the declared symbol.',
				},
			},
			required: ['appName', 'filePath', 'symbolPath'],
		},
	},
];

interface Sig {
	name: string;
	type: string;
	datatype: string;
	modifiers: string[];
	internals: Sig[];
	symbolPath: string[];
	canReadCode: boolean;
}

class FixtureMapper {
	buildSignatures(symbols: FixtureSymbol[]): Sig[] {
		const roots: Sig[] = [];
		for (const s of symbols) {
			const chain = s.id.slice(s.id.indexOf('#') + 1).split('.');
			let level = roots;
			const symbolPath: string[] = [];
			chain.forEach((name, i) => {
				let node = level.find((n) => n.name === name);
				if (!node) {
					node = {
						name,
						type: i === chain.length - 1 ? s.kind : 'class',
						datatype: '',
						modifiers: [],
						internals: [],
						symbolPath: [],
						canReadCode: false,
					};
					level.push(node);
				}
				if (i === chain.length - 1) {
					node.type = s.kind;
					node.datatype = s.signature ?? '';
					node.symbolPath = [...symbolPath, name];
					node.canReadCode = ['method', 'function', 'constructor', 'destructor'].includes(s.kind);
				}
				symbolPath.push(name);
				level = node.internals;
			});
		}
		return roots;
	}
}

class FixtureMethodResolver {
	resolve(
		fx: Fixture,
		url: string
	): { file: FixtureFile; symbol: FixtureSymbol } | undefined {
		for (const container of Object.values(fx.containers)) {
			for (const file of container.files) {
				if (!url.startsWith(file.path + '/')) continue;
				const chain = url
					.slice(file.path.length + 1)
					.split('/')
					.filter(Boolean)
					.join('.');
				const symbol = file.symbols.find(
					(s) => s.id === `${file.path}#${chain}`
				);
				if (symbol) return { file, symbol };
			}
		}
		return undefined;
	}
}

export class MockCoreClientFactory {
	constructor(
		private readonly mapper = new FixtureMapper(),
		private readonly resolver = new FixtureMethodResolver()
	) {}

	create(fixturePath: string): CoreClient {
		const fixture: Fixture = JSON.parse(
			fs.readFileSync(fixturePath, 'utf8')
		);

		const callTool = async (
			name: string,
			args: Record<string, unknown>
		): Promise<ToolCallResult> => {
			const appName = String(args.appName ?? '');
			const filePath = String(args.filePath ?? '').replace(/\/+$/, '');
			const symbolPath = Array.isArray(args.symbolPath)
				? args.symbolPath.map(String)
				: [];
			const source = [filePath, ...symbolPath].join('/');

			switch (name) {
				case 'getApplicationStructure': {
					const container = fixture.containers[appName];
					if (!container)
						return {
							content: { error: `Application not found: ${appName}` },
						};
					return {
						content: {
							files: container.files.map((f) => ({
								path: f.path,
								signatures: this.mapper.buildSignatures(
									f.symbols
								),
							})),
						},
					};
				}

				case 'readSymbolCode': {
					const hit = this.resolver.resolve(fixture, source);
					if (!hit)
						return {
							content: {
								error: `Could not find the declaration at ${source}`,
							},
						};
					if (!hit.symbol.code)
						return {
							content: { error: 'The declaration has no body' },
						};
					return { content: { body: hit.symbol.code.split('\n') } };
				}

				case 'findSymbolReferences': {
					const hit = this.resolver.resolve(fixture, source);
					if (!hit)
						return {
							content: {
								error: `Could not find the declaration at ${source}`,
							},
						};
					return {
						content: {
							references: (hit.symbol.calledBy ?? []).map(
								(id) => {
									const source = id.slice(0, id.indexOf('#'));
									const chain = id
										.slice(id.indexOf('#') + 1)
										.split('.');
									return {
										source,
										signature: {
											name: chain[chain.length - 1],
											type: 'method',
											datatype: '',
											modifiers: [],
											internals: [],
										},
										lineNumber: 1,
									};
								}
							),
						},
					};
				}

				default:
					return { content: { error: `unknown tool: ${name}` } };
			}
		};

		return { tools: MOCK_TOOLS, callTool, close: async () => {} };
	}
}

import { config } from '../config.js';
import type { CoreClient } from './types.js';
import { MockCoreClientFactory } from './mockCoreClient.js';
import { McpCoreClientFactory } from './coreClient.js';

export class CoreClientConnector {
	constructor(
		private readonly mockFactory = new MockCoreClientFactory(),
		private readonly mcpFactory = new McpCoreClientFactory()
	) {}

	async connect(): Promise<CoreClient> {
		if (config.CORE_MODE === 'mock')
			return this.mockFactory.create(config.MOCK_FIXTURE_PATH);
		return this.mcpFactory.create();
	}
}

export const coreConnector = new CoreClientConnector();

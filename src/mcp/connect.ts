import { config } from '../config.js';
import type { CoreClient } from './types.js';
import { createMockCoreClient } from './mockCoreClient.js';
import { createMcpCoreClient } from './coreClient.js';

export async function connectToCore(): Promise<CoreClient> {
	if (config.CORE_MODE === 'mock') {
		return createMockCoreClient(config.MOCK_FIXTURE_PATH);
	}
	return createMcpCoreClient();
}

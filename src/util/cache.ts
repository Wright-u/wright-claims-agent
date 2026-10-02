import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';

function keyFor(input: unknown): string {
	const hash = crypto
		.createHash('sha256')
		.update(JSON.stringify(input))
		.digest('hex');
	return hash.slice(0, 32);
}

function filePath(key: string): string {
	return path.join(config.LLM_CACHE_DIR, `${key}.json`);
}

export function readCache<T>(input: unknown): T | null {
	if (!config.LLM_CACHE_ENABLED) return null;
	const p = filePath(keyFor(input));
	if (!fs.existsSync(p)) return null;
	try {
		return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
	} catch {
		return null;
	}
}

export function writeCache(input: unknown, output: unknown): void {
	if (!config.LLM_CACHE_ENABLED) return;
	fs.mkdirSync(config.LLM_CACHE_DIR, { recursive: true });
	fs.writeFileSync(filePath(keyFor(input)), JSON.stringify(output, null, 2));
}

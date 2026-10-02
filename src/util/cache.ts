import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config } from '../config.js';

export class FileCache {
	constructor(
		private readonly enabled = config.LLM_CACHE_ENABLED,
		private readonly directory = config.LLM_CACHE_DIR
	) {}

	read<T>(input: unknown): T | null {
		if (!this.enabled) return null;
		const file = this.filePath(this.keyFor(input));
		if (!fs.existsSync(file)) return null;
		try {
			return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
		} catch {
			return null;
		}
	}

	write(input: unknown, output: unknown): void {
		if (!this.enabled) return;
		fs.mkdirSync(this.directory, { recursive: true });
		fs.writeFileSync(
			this.filePath(this.keyFor(input)),
			JSON.stringify(output, null, 2)
		);
	}

	private keyFor(input: unknown): string {
		const hash = crypto
			.createHash('sha256')
			.update(JSON.stringify(input))
			.digest('hex');
		return hash.slice(0, 32);
	}

	private filePath(key: string): string {
		return path.join(this.directory, `${key}.json`);
	}
}

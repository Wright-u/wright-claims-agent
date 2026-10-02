import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config.js';

export class AuthGuard {
	async require(req: FastifyRequest, reply: FastifyReply) {
		if (!config.AGENT_API_KEY) return;

		const header = req.headers.authorization ?? '';
		const token = header.startsWith('Bearer ') ? header.slice(7) : '';

		if (token !== config.AGENT_API_KEY) {
			reply.code(401).send({ error: 'unauthorized' });
		}
	}
}

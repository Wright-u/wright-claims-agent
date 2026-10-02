import type { FastifyInstance } from 'fastify';
import {
	NormalizeRequestSchema,
	NormalizeResponseSchema,
	VerifyRequestSchema,
	VerifyResponseSchema,
} from '../domain/schemas.js';
import { normalize } from '../normalize/normalize.js';
import { verify } from '../verify/loop.js';
import { requireAuth } from './auth.js';

export async function registerRoutes(app: FastifyInstance) {
	app.get('/health', async () => ({ status: 'ok', contractVersion: '0.1' }));

	app.post('/normalize', { preHandler: requireAuth }, async (req, reply) => {
		const body = NormalizeRequestSchema.parse(req.body);
		const claims = await normalize(body.containerId, body.narrative);
		const response = NormalizeResponseSchema.parse({ claims });
		reply.send(response);
	});

	app.post('/verify', { preHandler: requireAuth }, async (req, reply) => {
		const body = VerifyRequestSchema.parse(req.body);
		const result = await verify(body.containerId, body.claim);
		const response = VerifyResponseSchema.parse(result);
		reply.send(response);
	});
}

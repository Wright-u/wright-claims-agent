import type { FastifyInstance } from 'fastify';
import {
	VerifyRequestSchema,
	VerifyResponseSchema,
} from '../domain/schemas.js';
import { ClaimVerifier } from '../verify/loop.js';
import { AuthGuard } from './auth.js';

export class RouteRegistrar {
	constructor(
		private readonly verifier = new ClaimVerifier(),
		private readonly authGuard = new AuthGuard()
	) {}

	async register(app: FastifyInstance) {
		app.get('/health', async () => ({
			status: 'ok',
			contractVersion: '0.1',
		}));

		app.post(
			'/api/verify',
			{ preHandler: this.authGuard.require.bind(this.authGuard) },
			async (req, reply) => {
				const body = VerifyRequestSchema.parse(req.body);
				const result = await this.verifier.verify(
					body.appName,
					body.narrative
				);
				const response = VerifyResponseSchema.parse(result);
				reply.send(response);
			}
		);
	}
}

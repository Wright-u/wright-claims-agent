import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';

export class ApiErrorHandler {
	handle(
		error: FastifyError | Error,
		_req: FastifyRequest,
		reply: FastifyReply
	) {
		if (error instanceof ZodError) {
			reply
				.code(400)
				.send({ error: 'invalid_request', details: error.format() });
			return;
		}
		console.error(error);
		reply
			.code(500)
			.send({ error: 'internal_error', message: error.message });
	}
}
